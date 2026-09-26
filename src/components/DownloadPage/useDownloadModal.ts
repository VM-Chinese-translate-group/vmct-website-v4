import { siteConfig } from '@/config/site'
import type { Ref } from 'vue'
import { downloadQuestions } from '@/data/downloadQuestions'
import type { DownloadMethodItem } from './downloadMethods'
import type { DownloadQuestion } from '@/types/downloadQuestion'
import { convertInlineText } from '@/utils/zhconv'

type Translate = (key: string, params?: Record<string, unknown>) => string
type SweetAlert = (typeof import('sweetalert2'))['default']

interface UseDownloadModalOptions {
  locale: Ref<string>
  questionLoader?: (() => Promise<DownloadQuestion[]>) | null
  questions?: DownloadQuestion[] | null
  t: Translate
}

const QUESTION_OPTIONS = ['A', 'B', 'C', 'D']
let swalPromise: Promise<SweetAlert> | undefined

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] || character,
  )

const sanitizeQuestionContent = (content: string) =>
  escapeHtml(content).replace(/&lt;br\s*\/?&gt;/gi, '<br>')

const renderLineBreaks = (content: string) => content.replace(/\n/g, '<br>')

const getSafeImageUrl = (url?: string) => {
  if (!url || !/^(?:\/(?!\/)|https?:\/\/)/i.test(url)) return ''
  return escapeHtml(url)
}

const getQuestionKey = (question: DownloadQuestion) =>
  [question.title, question.content, question.correctAnswer].join('\n')

const getSwal = async () => {
  if (!swalPromise) {
    swalPromise = import('sweetalert2').then((module) => module.default)
  }
  return swalPromise
}

const openLink = (url?: string) => {
  if (!url) return

  const openedWindow = window.open(url, '_blank')
  if (openedWindow) openedWindow.opener = null
}

const getDownloadType = (item: DownloadMethodItem) => (item.id === 'lazy' ? 'lazy' : 'normal')

export function useDownloadModal(options: UseDownloadModalOptions) {
  const { locale, questionLoader, questions, t } = options
  const usedQuestionKeys = new Set<string>()

  const trackDownloadChoice = (
    stage: string,
    item: DownloadMethodItem,
    extra: Record<string, unknown> = {},
  ) => {
    window.gtag?.(`event`, `download_choice_${stage}`, {
      download_type: getDownloadType(item),
      download_method_id: item.id,
      download_method_name: item.name,
      ...extra,
    })
  }

  const openTrackedLink = (
    item: DownloadMethodItem,
    url = item.link,
    extra: Record<string, unknown> = {},
  ) => {
    trackDownloadChoice('open', item, extra)
    openLink(url)
  }

  const getQuestions = async () => {
    if (questions?.length) return questions
    if (questionLoader) return (await questionLoader()) || []

    return downloadQuestions
  }

  const getRandomQuestion = (allQuestions: DownloadQuestion[]) => {
    const availableQuestions = allQuestions.filter((question) => {
      return !usedQuestionKeys.has(getQuestionKey(question))
    })
    const questionPool = availableQuestions.length ? availableQuestions : allQuestions

    if (!availableQuestions.length) usedQuestionKeys.clear()

    const question = questionPool[Math.floor(Math.random() * questionPool.length)]
    usedQuestionKeys.add(getQuestionKey(question))

    return question
  }

  const setupButtonCountdown = (Swal: SweetAlert, seconds = 3) => {
    const confirmBtn = Swal.getConfirmButton()
    const denyBtn = Swal.getDenyButton()
    if (!confirmBtn) return () => {}

    const originalConfirm = confirmBtn.innerText
    const originalDeny = denyBtn?.innerText || ''

    let remaining = seconds
    const update = () => {
      confirmBtn.disabled = true
      if (denyBtn) denyBtn.disabled = true
      confirmBtn.innerText = t('downloadModal.countdown', {
        label: originalConfirm,
        seconds: remaining,
      })
      if (denyBtn) {
        denyBtn.innerText = t('downloadModal.countdown', {
          label: originalDeny,
          seconds: remaining,
        })
      }
    }

    update()
    const timer = setInterval(() => {
      remaining--
      if (remaining <= 0) {
        clearInterval(timer)
        confirmBtn.disabled = false
        if (denyBtn) denyBtn.disabled = false
        confirmBtn.innerText = originalConfirm
        if (denyBtn) denyBtn.innerText = originalDeny
      } else {
        update()
      }
    }, 1000)

    return () => clearInterval(timer)
  }

  const agreementLink = () =>
    `<a href="/agreement/" target="_blank" rel="noopener noreferrer" class="modal-link">${t('downloadModal.agreement')}</a>`

  const installGuideLink = () =>
    `<a href="${siteConfig.docsUrl}/tutorial/modpack/translation.html" target="_blank" rel="noopener noreferrer" class="modal-link">${t('downloadModal.installGuide')}</a>`

  const installGuideNotice = (hasInstallGuide = true) =>
    hasInstallGuide
      ? t('downloadModal.installGuideJoiner', { installGuide: installGuideLink() })
      : t('downloadModal.noticeEnd')

  const colorText = (text: string) =>
    text
      .split('')
      .map((char, index) => `<span style="--char-index:${index}">${escapeHtml(char)}</span>`)
      .join('')

  const getDownloadModalHtml = (item: DownloadMethodItem, showInstallLink = true) => `
    <div class="modal-content-container">
      <p class="intro-text">${t('downloadModal.driveIntro')}</p>
      <ul class="download-options-list">
        <li class="option-item recommended" data-drive="quark" role="button" tabindex="0">
          <div class="option-title">
            <span class="option-title-content">
              <span class="option-emoji">📂</span>
              <strong>${t('downloadModal.quarkTitle')}</strong>
            </span>
          </div>
          <div class="option-desc">${t('downloadModal.quarkDesc', {
            emphasis: `<strong>${escapeHtml(t('downloadModal.quarkEmphasis'))}</strong>`,
          })}</div>
        </li>
        <li class="option-item lanzou" data-drive="lanzou" role="button" tabindex="0">
          <div class="option-title">
            <span class="option-title-content">
              <span class="option-emoji">🚀</span>
              <strong>${t('downloadModal.lanzouTitle')}</strong>
            </span>
          </div>
          <div class="option-desc">${t('downloadModal.lanzouDesc')}</div>
        </li>
        ${
          item.lazyLink
            ? `<li class="option-item lazy-option" data-drive="lazy" role="button" tabindex="0">
                <div class="option-title">
                  <span class="option-title-content">
                    <img src="/imgs/lazydl.png" class="option-icon" alt="" />
                    <strong class="lazy-rainbow">${colorText(t('downloadModal.lazyTitle'))}</strong>
                  </span>
                </div>
                <div class="option-desc">${t('downloadModal.lazyDesc')}</div>
              </li>`
            : ''
        }
      </ul>
      <p class="important-notice">
        <strong>${t('downloadModal.noticeTitle')}</strong>${t('downloadModal.noticeRead', {
          agreement: agreementLink(),
        })}${installGuideNotice(showInstallLink)}
      </p>
    </div>`

  const buildQuestionHtml = (question: DownloadQuestion, content: string) => `
    <div class="modal-content-container">
      <div class="question-content">
        ${sanitizeQuestionContent(content)}
      </div>
      ${
        getSafeImageUrl(question.imageUrl)
          ? `<img loading="lazy" src="${getSafeImageUrl(question.imageUrl)}" class="question-image" alt=""/>`
          : ''
      }
      <div class="question-actions">
        ${
          question.isInput
            ? `<input type="text" id="swal-input" class="swal2-input question-input" placeholder="${escapeHtml(t('downloadModal.answerPlaceholder'))}">`
            : QUESTION_OPTIONS.map(
                (option) =>
                  `<button class="btn btn-lanzou q-btn" data-value="${option}">${option}</button>`,
              ).join('')
        }
      </div>
    </div>`

  const validateAnswer = async (input: string, correct: string, item: DownloadMethodItem) => {
    const Swal = await getSwal()

    if (input.trim().toUpperCase() === correct.toUpperCase()) {
      Swal.fire({
        title: t('downloadModal.correctTitle'),
        icon: 'success',
        customClass: {
          popup: 'vm-swal-popup',
          htmlContainer: 'vm-swal-html-container',
          confirmButton: 'btn btn-lanzou',
        },
        html: `
          <div class="modal-content-container">
            ${renderLineBreaks(
              t('downloadModal.correctBody', {
                agreement: agreementLink(),
                installGuide: installGuideLink(),
              }),
            )}
          </div>`,
        showCancelButton: false,
        confirmButtonText: t('downloadModal.ok'),
      }).then((result) => result.isConfirmed && openTrackedLink(item))
    } else {
      Swal.fire({
        icon: 'error',
        title: t('downloadModal.wrongTitle'),
        customClass: { popup: 'vm-swal-popup' },
        text: t('downloadModal.wrongText'),
      }).then(() => {
        showQuestionModal(item)
      })
    }
  }

  const showQuestionModal = async (item: DownloadMethodItem) => {
    const [Swal, allQuestions] = await Promise.all([getSwal(), getQuestions()])
    if (!allQuestions.length) {
      await Swal.fire({
        icon: 'error',
        title: t('downloadModal.questionLoadErrorTitle'),
        customClass: { popup: 'vm-swal-popup' },
        text: t('downloadModal.questionLoadErrorText'),
      })
      return
    }

    const question = getRandomQuestion(allQuestions)
    const [title, content] = await Promise.all([
      convertInlineText(question.title, locale.value),
      convertInlineText(question.content, locale.value),
    ])
    let tempInput = ''
    let hasAnswered = false

    Swal.fire({
      title,
      customClass: {
        popup: 'vm-swal-popup',
        htmlContainer: 'vm-swal-html-container',
        confirmButton: 'btn btn-quark',
      },
      html: buildQuestionHtml(question, content),
      showConfirmButton: !!question.isInput,
      confirmButtonText: t('downloadModal.submit'),
      showCancelButton: false,
      showCloseButton: true,
      didOpen: () => {
        const container = Swal.getHtmlContainer()
        if (!container) return

        container.querySelectorAll<HTMLButtonElement>('.q-btn').forEach((btn) => {
          btn.onclick = () => {
            if (hasAnswered) return
            hasAnswered = true
            container.querySelectorAll<HTMLButtonElement>('.q-btn').forEach((button) => {
              button.disabled = true
            })
            Swal.close()
            validateAnswer(btn.getAttribute('data-value') || '', question.correctAnswer, item)
          }
        })
        const input = document.getElementById('swal-input') as HTMLInputElement | null
        if (input) {
          input.oninput = (event) => {
            tempInput = (event.target as HTMLInputElement).value
          }
        }
      },
      preConfirm: () => (question.isInput ? tempInput : null),
    }).then((result) => {
      if (result.isConfirmed && question.isInput) {
        if (hasAnswered) return
        hasAnswered = true
        validateAnswer(tempInput, question.correctAnswer, item)
      }
    })
  }

  const showProtocolModal = async (item: DownloadMethodItem, hasInstallGuide = true) => {
    const Swal = await getSwal()
    let stopCountdown = () => {}

    Swal.fire({
      title: t('downloadModal.protocolTitle'),
      icon: 'info',
      html: `${t('downloadModal.noticeRead', {
        agreement: agreementLink(),
      })}${installGuideNotice(hasInstallGuide)}`,
      showCancelButton: true,
      confirmButtonText: t('downloadModal.ok'),
      cancelButtonText: t('downloadModal.cancel'),
      reverseButtons: true,
      customClass: {
        popup: 'vm-swal-popup',
        confirmButton: 'btn btn-lanzou',
        cancelButton: 'btn btn-cancel',
      },
      didOpen: () => {
        stopCountdown = setupButtonCountdown(Swal, 3)
      },
      willClose: () => stopCountdown(),
    }).then((result) => result.isConfirmed && openTrackedLink(item))
  }

  const showMultiDriveModal = async (item: DownloadMethodItem, hasInstallGuide = true) => {
    const Swal = await getSwal()

    const lazyItem = {
      ...item,
      id: 'lazy',
      name: t('downloadModal.lazyTitle'),
      link: item.lazyLink,
    }

    Swal.fire({
      title: t('downloadModal.driveTitle'),
      html: getDownloadModalHtml(item, hasInstallGuide),
      showConfirmButton: false,
      showDenyButton: false,
      showCancelButton: false,
      showCloseButton: true,
      customClass: {
        popup: 'vm-swal-popup',
        htmlContainer: 'vm-swal-html-container',
      },
      didOpen: (modal: HTMLElement) => {
        const icon = modal.querySelector('.swal2-icon')
        if (icon) icon.setAttribute('hidden', 'true')
        let hasChosen = false
        const openDrive = (drive: string | null) => {
          if (hasChosen) return
          hasChosen = true
          modal.querySelectorAll('.option-item[data-drive]').forEach((option: Element) => {
            option.classList.add('is-disabled')
            option.setAttribute('aria-disabled', 'true')
          })

          if (drive === 'quark') {
            trackDownloadChoice('select', item, { drive: 'quark' })
            Swal.close()
            openTrackedLink(item, item.quarkLink, { drive: 'quark' })
          } else if (drive === 'lanzou') {
            trackDownloadChoice('select', item, { drive: 'lanzou' })
            Swal.close()
            openTrackedLink(item, item.lanzouLink, { drive: 'lanzou' })
          } else if (drive === 'lazy') {
            trackDownloadChoice('select', lazyItem, { drive: 'lazy' })
            Swal.close()
            showQuestionModal(lazyItem)
          }
        }

        modal.querySelectorAll('.option-item[data-drive]').forEach((option: Element) => {
          const drive = option.getAttribute('data-drive')
          option.addEventListener('click', () => openDrive(drive))
          option.addEventListener('keydown', (event) => {
            const keyboardEvent = event as KeyboardEvent
            if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') return
            keyboardEvent.preventDefault()
            openDrive(drive)
          })
        })
      },
    })
  }

  const modalConfig: Record<string, (item: DownloadMethodItem) => void> = {
    lanzou: (item) => showProtocolModal(item, true),
    mapdl: (item) => showProtocolModal(item, false),
    lazy: (item) => showQuestionModal(item),
    'quark-lanzou': (item) => showMultiDriveModal(item, true),
    'lanzou-quark-mapdl': (item) => showMultiDriveModal(item, false),
  }

  const handleDownloadMethod = (item: DownloadMethodItem) => {
    const handler = item.id ? modalConfig[item.id] : undefined
    if (handler) {
      if (!item.quarkLink || !item.lanzouLink) trackDownloadChoice('select', item)
      handler(item)
    } else if (item.link) {
      trackDownloadChoice('select', item)
      openTrackedLink(item)
    }
  }

  return { handleDownloadMethod }
}
