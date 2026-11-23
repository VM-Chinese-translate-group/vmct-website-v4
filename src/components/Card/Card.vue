<template>
  <a
    :href="isExternal ? link : withBase(link)"
    :target="isExternal ? '_blank' : '_self'"
    class="card relative m-0 box-border flex h-full min-h-[112px] w-full flex-row items-center overflow-hidden border-none rounded-[var(--link-radius)] bg-[var(--bg-soft)]! text-[var(--text-1)]! no-underline! transition-[background-color,transform] duration-200 ease-[ease] hover:-translate-y-0.5 hover:bg-[var(--link-bg-hover)]! hover:no-underline!"
    :title="title"
  >
    <Icon
      v-if="isExternal"
      icon="lucide:external-link"
      class="pointer-events-none absolute right-[18px] top-4 h-4 w-4 text-[var(--text-muted)] opacity-40"
      aria-hidden="true"
    />
    <div class="flex h-full w-full flex-row items-center px-6">
      <template v-if="!logoMissing">
        <img
          class="mr-5 h-14 w-14 flex-shrink-0 rounded-2 bg-transparent object-cover"
          :src="logoLink"
        />
      </template>

      <div class="flex h-full min-w-0 flex-1 flex-col justify-center pr-6">
        <div
          class="mb-1 max-w-full whitespace-normal break-words text-[1.15rem] text-[var(--info-1)]! font-600 no-underline! [overflow-wrap:break-word]"
        >
          {{ title }}
        </div>
        <div
          class="max-w-full overflow-hidden whitespace-normal break-words text-[0.95rem] text-[var(--text-muted)]! leading-[1.4] no-underline! [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [line-clamp:2] [overflow-wrap:break-word]"
        >
          {{ descText }}
        </div>
      </div>
    </div>
  </a>
</template>

<script setup lang="ts">
import { Icon } from '@/icons'
import { computed } from 'vue'

interface CardProps {
  title: string
  desc?: string
  logo?: string
  link?: string
}

const props = withDefaults(defineProps<CardProps>(), {
  desc: '',
  logo: '',
  link: '',
})

const BASE = ''

function withBase(url: string) {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  return BASE + url
}

function isLinkExternal(url: string) {
  return /^https?:\/\//.test(url)
}

function isRelativeLink(url: string) {
  return !/^https?:\/\//.test(url)
}

const isExternal = computed(() => isLinkExternal(props.link))

const logoLink = computed(() => {
  if (props.logo === '') {
    return withBase('/imgs/missing.png')
  }

  return isRelativeLink(props.logo) ? withBase(props.logo) : props.logo
})

const logoMissing = computed(() => logoLink.value === 'no-logo')

const descText = computed(() => {
  if (props.desc) return props.desc
  return props.link || ''
})
</script>
