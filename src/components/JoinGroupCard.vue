<template>
  <section
    class="mb-5 border border-[color-mix(in_srgb,var(--text-muted)_18%,transparent)] border-solid rounded-4 bg-[var(--bg-soft)] px-[30px] py-[26px] transition-[transform,box-shadow,border-color] duration-[180ms] ease-[ease] hover:-translate-y-1"
  >
    <header class="mb-5 flex items-center justify-between gap-4">
      <h2 class="m-0 flex items-center text-[1.6rem] text-[var(--text-1)] font-600">
        {{ title }}
      </h2>

      <a
        class="inline-flex h-10 flex-shrink-0 items-center justify-center rounded-[9px] bg-[var(--btn-primary-bg)]! px-[18px] text-[0.95rem] text-white! font-bold no-underline! [transition-property:background,transform,box-shadow] duration-150 ease-[ease] hover:-translate-y-px hover:bg-[var(--btn-primary-hover)]!"
        :href="applyLink"
        target="_blank"
        rel="noopener"
      >
        立即申请
      </a>
    </header>

    <div>
      <h3 class="mb-2 mt-0 text-[1.15rem] text-[var(--text-1)] font-600">负责内容</h3>

      <ol
        class="mt-0 pl-[1.25em] text-[0.95rem] leading-[1.8]"
        :class="requirements?.length ? 'mb-[18px]' : 'mb-0'"
      >
        <li v-for="(item, i) in responsibilities" :key="i">
          {{ item }}
        </li>
      </ol>

      <template v-if="requirements?.length">
        <h3 class="mb-2 mt-0 text-[1.15rem] text-[var(--text-1)] font-600">要求</h3>

        <ol class="m-0 pl-[1.25em] text-[0.95rem] leading-[1.8]">
          <li v-for="(item, i) in requirements" :key="i">
            {{ item }}
          </li>
        </ol>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  applyLink: string
  responsibilities: string[]
  requirements?: string[]
}>()
</script>
