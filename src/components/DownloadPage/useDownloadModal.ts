import { onBeforeUnmount, ref, shallowRef, type Ref } from 'vue'
import { downloadQuestions } from '@/data/downloadQuestions'
import type { DownloadMethodItem } from './downloadMethods'
import type { DownloadQuestion } from '@/types/downloadQuestion'
import { convertInlineText } from '@/utils/zhconv'

type Translate = (key: string, params?: Record<string, unknown>) => string

interface UseDownloadModalOptions {
  locale: Ref<string>
  questionLoader?: (() => Promise<DownloadQuestion[]>) | null
  questions?: DownloadQuestion[] | null
  t: Translate
}

type DownloadDialog =
  | { kind: 'drive' | 'protocol'; item: DownloadMethodItem; hasInstallGuide: boolean }
  | { kind: 'question'; item: DownloadMethodItem; question: DownloadQuestion }
  | { kind: 'correct' | 'wrong' | 'question-error'; item: DownloadMethodItem }

const getQuestionKey = (question: DownloadQuestion) =>
  [question.title, question.content, question.correctAnswer].join('\n')

const openLink = (url?: string) => {
  if (!url) return
  const openedWindow = window.open(url, '_blank')
  if (openedWindow) openedWindow.opener = null
}

export function useDownloadModal(options: UseDownloadModalOptions) {
  const { locale, questionLoader, questions, t } = options
  const usedQuestionKeys = new Set<string>()
  const dialog = shallowRef<DownloadDialog | null>(null)
  const open = ref(false)
  const busy = ref(false)
  const answer = ref('')
  const remaining = ref(0)
  let countdown: number | undefined
  let questionRequest = 0

  const trackDownloadChoice = (
    stage: string,
    item: DownloadMethodItem,
    extra: Record<string, unknown> = {},
  ) => {
    window.gtag?.('event', `download_choice_${stage}`, {
      download_type: item.id === 'lazy' ? 'lazy' : 'normal',
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

  const stopCountdown = () => {
    clearInterval(countdown)
    countdown = undefined
  }

  const close = () => {
    questionRequest++
    busy.value = false
    open.value = false
    stopCountdown()
  }

  const showQuestion = async (item: DownloadMethodItem) => {
    const request = ++questionRequest
    busy.value = true
    stopCountdown()
    try {
      const allQuestions = questions?.length
        ? questions
        : questionLoader
          ? (await questionLoader()) || []
          : downloadQuestions
      if (request !== questionRequest) return
      if (!allQuestions.length) {
        dialog.value = { kind: 'question-error', item }
      } else {
        const available = allQuestions.filter(
          (question) => !usedQuestionKeys.has(getQuestionKey(question)),
        )
        if (!available.length) usedQuestionKeys.clear()
        const pool = available.length ? available : allQuestions
        const question = pool[Math.floor(Math.random() * pool.length)]
        usedQuestionKeys.add(getQuestionKey(question))
        const [title, content] = await Promise.all([
          convertInlineText(question.title, locale.value),
          convertInlineText(question.content, locale.value),
        ])
        if (request !== questionRequest) return
        answer.value = ''
        dialog.value = { kind: 'question', item, question: { ...question, title, content } }
      }
      open.value = true
    } catch {
      if (request !== questionRequest) return
      dialog.value = { kind: 'question-error', item }
      open.value = true
    } finally {
      if (request === questionRequest) busy.value = false
    }
  }

  const submitAnswer = (input = answer.value) => {
    const current = dialog.value
    if (!open.value || busy.value || current?.kind !== 'question') return
    dialog.value = {
      kind:
        input.trim().toUpperCase() === current.question.correctAnswer.toUpperCase()
          ? 'correct'
          : 'wrong',
      item: current.item,
    }
  }

  const dismiss = () => {
    if (dialog.value?.kind === 'wrong' && !busy.value) void showQuestion(dialog.value.item)
    else close()
  }

  const confirm = () => {
    const current = dialog.value
    if (!open.value || busy.value || !current) return
    if (current.kind === 'question') {
      submitAnswer()
    } else if (current.kind === 'correct' || current.kind === 'protocol') {
      if (current.kind === 'protocol' && remaining.value > 0) return
      close()
      openTrackedLink(current.item)
    } else {
      dismiss()
    }
  }

  const chooseDrive = (drive: 'quark' | 'lanzou' | 'lazy') => {
    const current = dialog.value
    if (!open.value || busy.value || current?.kind !== 'drive') return
    if (drive === 'lazy') {
      const item = {
        ...current.item,
        id: 'lazy',
        name: t('downloadModal.lazyTitle'),
        link: current.item.lazyLink,
      }
      trackDownloadChoice('select', item, { drive })
      void showQuestion(item)
    } else {
      trackDownloadChoice('select', current.item, { drive })
      close()
      openTrackedLink(
        current.item,
        drive === 'quark' ? current.item.quarkLink : current.item.lanzouLink,
        { drive },
      )
    }
  }

  const modalConfig: Record<string, (item: DownloadMethodItem) => void> = {
    lanzou: (item) => showProtocol(item, true),
    mapdl: (item) => showProtocol(item, false),
    lazy: (item) => {
      void showQuestion(item)
    },
    'quark-lanzou': (item) => showDrives(item, true),
    'lanzou-quark-mapdl': (item) => showDrives(item, false),
  }

  function showProtocol(item: DownloadMethodItem, hasInstallGuide: boolean) {
    dialog.value = { kind: 'protocol', item, hasInstallGuide }
    remaining.value = 3
    open.value = true
    countdown = window.setInterval(() => {
      remaining.value--
      if (remaining.value <= 0) stopCountdown()
    }, 1000)
  }

  function showDrives(item: DownloadMethodItem, hasInstallGuide: boolean) {
    dialog.value = { kind: 'drive', item, hasInstallGuide }
    open.value = true
  }

  const isDialogMethod = (item: DownloadMethodItem) =>
    Boolean(item.id && Object.hasOwn(modalConfig, item.id))

  const handleDownloadMethod = (item: DownloadMethodItem) => {
    close()
    const handler = isDialogMethod(item) ? modalConfig[item.id!] : undefined
    if (handler) {
      if (!item.quarkLink || !item.lanzouLink) trackDownloadChoice('select', item)
      handler(item)
    } else if (item.link) {
      trackDownloadChoice('select', item)
      openTrackedLink(item)
    }
  }

  onBeforeUnmount(close)

  return {
    dialog,
    open,
    busy,
    answer,
    remaining,
    dismiss,
    close,
    confirm,
    submitAnswer,
    chooseDrive,
    isDialogMethod,
    handleDownloadMethod,
  }
}
