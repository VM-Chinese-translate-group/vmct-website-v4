<template>
  <div
    v-if="open"
    class="fixed inset-0 z-70 grid place-items-center bg-black/40 p-4"
    @click.self="$emit('close')"
  >
    <section
      class="w-[min(34rem,100%)] rounded-2xl border border-[var(--switcher-border)] bg-[var(--bg-alt)] p-5 shadow-2xl"
    >
      <h2 class="m-0 text-xl">发布前检查</h2>
      <p class="text-sm text-[var(--text-2)]">确认后会发布当前草稿并请求 Cloudflare 完整构建。</p>
      <div
        v-if="errors.length"
        class="my-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"
      >
        <strong>需要处理</strong>
        <ul class="mb-0 pl-5">
          <li v-for="issue in errors" :key="issue.field + issue.message">{{ issue.message }}</li>
        </ul>
      </div>
      <div
        v-if="warnings.length"
        class="my-3 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200"
      >
        <strong>建议确认</strong>
        <ul class="mb-0 pl-5">
          <li v-for="issue in warnings" :key="issue.field + issue.message">{{ issue.message }}</li>
        </ul>
      </div>
      <label class="cms-label mt-4">
        发布说明（可选）
        <textarea
          v-model="message"
          class="cms-field"
          rows="2"
          placeholder="例如：更新 1.21.1 下载链接"
        />
      </label>
      <div class="mt-5 flex justify-end gap-2">
        <button class="cms-button" @click="$emit('close')">取消</button>
        <button
          class="cms-primary-button"
          :disabled="busy || errors.length > 0"
          @click="$emit('confirm', message)"
        >
          {{ busy ? '发布中…' : '确认发布' }}
        </button>
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ValidationIssue } from './types'
const props = defineProps<{
  open: boolean
  busy: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}>()
defineEmits<{ close: []; confirm: [message: string] }>()
const message = ref('')
watch(
  () => props.open,
  (open) => {
    if (open) message.value = ''
  },
)
</script>
