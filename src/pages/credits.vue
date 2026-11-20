<template>
  <main
    class="credits-page [--credits-bg:var(--bg-off-white)] [--credits-panel:var(--bg-white)] [--credits-text:var(--text-dark)] [--credits-muted:var(--text-light)] [--credits-soft:var(--bg-soft)] [--credits-border:var(--switcher-border)] [--credits-accent:var(--brand-primary)] [--credits-accent-soft:var(--info-soft)] [--credits-line:linear-gradient(_180deg,_transparent,_var(--credits-accent)_12%,_var(--tip-1)_50%,_var(--credits-accent)_88%,_transparent_)] min-h-[100vh] p-[72px_16px_96px] [background:linear-gradient(180deg,_var(--credits-bg),_var(--credits-soft)),_var(--credits-bg)] text-[var(--credits-text)] dark:[--credits-bg:#14161b] dark:[--credits-panel:#1f222a] dark:[--credits-soft:#181b21] dark:[--credits-border:rgba(235,_235,_245,_0.14)] dark:[--credits-text:#f1f5f9] dark:[--credits-muted:#b7c0cf] dark:[--credits-accent:#8fb2ff] dark:[--credits-accent-soft:rgba(143,_178,_255,_0.18)] max-[820px]:p-[48px_12px_72px]"
  >
    <section
      class="credits-hero w-[min(1120px,_100%)] m-[0_auto] grid gap-[18px] p-[36px_0_44px] [&_h1]:m-0 [&_h1]:text-[var(--credits-text)] [&_h1]:text-[clamp(2.6rem,_7vw,_5.4rem)] [&_h1]:leading-[1]"
    >
      <p
        class="credits-kicker m-0 text-[var(--credits-accent)] text-[0.78rem] font-800 tracking-[0.16em]"
      >
        CREDITS
      </p>
      <h1>贡献名单</h1>
      <p
        class="credits-intro max-w-[760px] m-0 text-[var(--credits-muted)] text-[1rem] leading-[1.85]"
      >
        感谢每一位为官网、VM 汉化组与社区内容付出时间的人。名单中，一半黑体字为 B
        站用户名，括号内为称呼，小字为 GitHub 或 Paratranz 用户名。
      </p>

      <div
        class="credits-stats grid grid-cols-[repeat(3,_minmax(0,_1fr))] gap-3 mt-2 max-[820px]:grid-cols-[1fr]"
        aria-label="贡献名单统计"
      >
        <div
          v-for="category in categories"
          :key="category.id"
          class="credits-stat flex items-center justify-between gap-4 p-[16px_18px] [border:1px_solid_var(--credits-border)] rounded-lg [background:var(--credits-panel)] [box-shadow:var(--vp-shadow-1)] [&_span]:text-[var(--credits-muted)] [&_span]:text-[0.92rem] [&_strong]:text-[var(--credits-accent)] [&_strong]:text-[1.35rem]"
        >
          <span>{{ category.label }}</span>
          <strong>{{ category.people.length }}</strong>
        </div>
      </div>
    </section>

    <section
      class="credits-reel w-[min(1120px,_100%)] m-[0_auto] relative grid gap-[34px] pl-[42px] [&::before]:[content:''] [&::before]:absolute [&::before]:[top:0] [&::before]:[bottom:0] [&::before]:[left:14px] [&::before]:w-1 [&::before]:rounded-[999px] [&::before]:[background:var(--credits-line)] max-[560px]:pl-[30px] max-[560px]:[&::before]:[left:10px]"
      aria-label="分类贡献名单"
    >
      <article
        v-for="(category, categoryIndex) in categories"
        :key="category.id"
        class="credit-section relative grid gap-[18px] [animation:creditReveal_0.55s_ease_both] [animation-delay:calc(var(--section-index)_*_0.08s)] motion-reduce:[animation:none]"
        :style="{ '--section-index': categoryIndex }"
      >
        <div
          class="credit-marker absolute [top:13px] [left:-36px] w-[18px] h-[18px] [border:4px_solid_var(--credits-bg)] rounded-[999px] [background:var(--credits-accent)] [box-shadow:0_0_0_6px_var(--credits-accent-soft)] max-[560px]:[left:-28px]"
          aria-hidden="true"
        ></div>

        <div
          class="credit-heading flex items-start gap-4 [&_h2]:m-0 [&_h2]:text-[clamp(1.7rem,_4vw,_2.6rem)] [&_h2]:leading-[1.12] [&_p]:m-[8px_0_0] [&_p]:text-[var(--credits-muted)] [&_p]:leading-[1.7] max-[560px]:gap-[10px]"
        >
          <span
            class="credit-number text-[var(--credits-accent)] text-[0.86rem] font-800 leading-[2.4]"
          >
            {{ String(categoryIndex + 1).padStart(2, '0') }}
          </span>

          <div>
            <h2>{{ category.label }}</h2>
            <p>{{ category.description }}</p>
          </div>
        </div>

        <ol
          class="credit-list grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-[10px] p-0 m-0 [list-style:none] max-[820px]:grid-cols-[1fr]"
        >
          <li
            v-for="(person, personIndex) in category.people"
            :key="`${category.id}-${person.name}-${personIndex}`"
            class="credit-person grid grid-cols-[52px_minmax(0,_1fr)] [grid-template-areas:'avatar_name'_'avatar_account'] gap-[3px_14px] [align-content:center] items-center min-h-[76px] p-[15px_16px] [border:1px_solid_color-mix(in_srgb,_var(--credits-border),_transparent_18%)] rounded-lg [background:color-mix(in_srgb,_var(--credits-panel),_transparent_5%)] [box-shadow:var(--vp-shadow-1)] [animation:creditReveal_0.45s_ease_both] [animation-delay:calc(var(--section-index)_*_0.08s_+_var(--person-index)_*_0.012s)] motion-reduce:[animation:none] max-[560px]:grid-cols-[46px_minmax(0,_1fr)] max-[560px]:p-[14px_12px]"
            :style="{ '--person-index': personIndex }"
          >
            <a
              v-if="person.uidText"
              class="person-avatar [grid-area:avatar] grid place-items-center w-12 h-12 overflow-hidden [border:1px_solid_var(--credits-border)] rounded-[999px] [background:linear-gradient(135deg,_var(--credits-accent-soft),_var(--credits-soft))] text-[var(--credits-accent)] text-[1rem] font-900 no-underline [&_img]:relative [&_img]:z-[1] [&_img]:w-full [&_img]:h-full [&_img]:object-cover [&_img]:[background:var(--credits-panel)] [&_img[hidden]]:hidden max-[560px]:w-[42px] max-[560px]:h-[42px]"
              :href="person.spaceUrl"
              target="_blank"
              rel="noreferrer"
              :aria-label="`打开 ${person.displayName} 的 B站空间`"
            >
              <img
                v-if="avatarMap[person.uidText]"
                :src="avatarMap[person.uidText]"
                :alt="`${person.displayName} 的头像`"
                loading="lazy"
                referrerpolicy="no-referrer"
                @error="onAvatarError(person.uidText)"
              />
              <span>{{ person.initial }}</span>
            </a>

            <span
              v-else
              class="person-avatar [grid-area:avatar] grid place-items-center w-12 h-12 overflow-hidden [border:1px_solid_var(--credits-border)] rounded-[999px] [background:linear-gradient(135deg,_var(--credits-accent-soft),_var(--credits-soft))] text-[var(--credits-accent)] text-[1rem] font-900 no-underline [&_img]:relative [&_img]:z-[1] [&_img]:w-full [&_img]:h-full [&_img]:object-cover [&_img]:[background:var(--credits-panel)] [&_img[hidden]]:hidden max-[560px]:w-[42px] max-[560px]:h-[42px]"
              aria-hidden="true"
            >
              <span>{{ person.initial }}</span>
            </span>

            <a
              v-if="person.uidText"
              class="person-main [grid-area:name] min-w-0 text-[var(--credits-text)] leading-[1.35] [&_strong]:font-900 [&_strong]:[overflow-wrap:anywhere] person-link no-underline [transition:color_0.2s_ease] [&:hover_strong]:text-[var(--credits-accent)] [&:focus-visible_strong]:text-[var(--credits-accent)]"
              :href="person.spaceUrl"
              target="_blank"
              rel="noreferrer"
            >
              <strong>{{ person.displayName }}</strong>
              <span
                v-if="person.nickname"
                class="person-nickname text-[var(--credits-muted)] [overflow-wrap:anywhere]"
              >
                （{{ person.nickname }}）
              </span>
            </a>

            <span
              v-else
              class="person-main [grid-area:name] min-w-0 text-[var(--credits-text)] leading-[1.35] [&_strong]:font-900 [&_strong]:[overflow-wrap:anywhere]"
            >
              <strong>{{ person.displayName }}</strong>
              <span
                v-if="person.nickname"
                class="person-nickname text-[var(--credits-muted)] [overflow-wrap:anywhere]"
              >
                （{{ person.nickname }}）
              </span>
            </span>

            <small
              v-if="person.title"
              class="person-account [grid-area:account] min-w-0 text-[var(--credits-muted)] text-[0.78rem] leading-[1.45] [overflow-wrap:anywhere]"
            >
              {{ person.title.trim() }}
            </small>
          </li>
        </ol>
      </article>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'

import { creditCategories } from '@/data/credits'
import type { CreditPerson, DisplayCreditPerson } from '@/types/credit'

const rawCategories = creditCategories

const BILIBILI_AVATAR_API = 'https://vmct.top/api/bilibili'
const BILIBILI_UID_BATCH_SIZE = 30

const avatarMap = reactive<Record<string, string>>({})

let avatarRequestPending = false

const categories = computed(() =>
  rawCategories.map((category) => ({
    ...category,
    people: category.people.map(normalizePerson),
  })),
)

const allUids = computed(() => {
  const uids = new Set<string>()

  for (const category of categories.value) {
    for (const person of category.people) {
      if (person.uidText) uids.add(person.uidText)
    }
  }

  return [...uids]
})

function normalizePerson(person: CreditPerson): DisplayCreditPerson {
  const uidText = person.uid == null ? '' : String(person.uid).trim()
  const { displayName, nickname } = splitName(person.name)

  return {
    ...person,
    uidText,
    displayName,
    nickname,
    initial: displayName.charAt(0).toUpperCase(),
    spaceUrl: uidText ? `https://space.bilibili.com/${encodeURIComponent(uidText)}` : '',
  }
}

function splitName(rawName: string) {
  const normalized = rawName.trim()
  const match = normalized.match(/^(.*?)[（(]([^（）()]+)[）)]$/)

  return {
    displayName: match ? match[1].trim() : normalized,
    nickname: match ? match[2].trim() : '',
  }
}

async function loadBilibiliAvatars(uids: string[]) {
  const missedUids = uids.filter((uid) => uid && !avatarMap[uid])

  if (!missedUids.length || avatarRequestPending) return

  avatarRequestPending = true

  try {
    const batches = chunkArray(missedUids, BILIBILI_UID_BATCH_SIZE)

    for (const batch of batches) {
      await loadBilibiliAvatarBatch(batch)
    }
  } finally {
    avatarRequestPending = false
  }
}

async function loadBilibiliAvatarBatch(uids: string[]) {
  if (!uids.length) return

  try {
    const apiUrl = new URL(BILIBILI_AVATAR_API)

    // 保留你说的拼 uid/uids：批量用 uids=1,2,3
    apiUrl.searchParams.set('uids', uids.join(','))

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) return

    const faces = (await response.json()) as Record<string, unknown>

    for (const uid of uids) {
      const face = typeof faces[uid] === 'string' ? faces[uid].trim() : ''

      if (/^https:\/\/.+/i.test(face)) {
        avatarMap[uid] = face
      }
    }
  } catch (error) {
    console.warn('Load Bilibili avatar batch failed:', error)
  }
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }

  return chunks
}

function onAvatarError(uid: string) {
  if (!uid) return
  delete avatarMap[uid]
}

onMounted(() => {
  void loadBilibiliAvatars(allUids.value)
})
</script>
