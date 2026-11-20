<script setup lang="ts">
import { Icon } from '@iconify/vue'
</script>

<template>
  <span
    class="error-status-icon grid place-items-center w-18 h-18 rounded-[50%] [background:var(--danger-soft)] text-[var(--danger-1)] [animation:error-status-pop_320ms_cubic-bezier(0.2,_0.8,_0.2,_1)_both] motion-reduce:[animation:none] motion-reduce:[stroke-dashoffset:0]"
    aria-hidden="true"
  >
    <Icon
      class="error-status-cross w-9 h-9 [&_path]:[stroke-dasharray:16] [&_path]:[stroke-dashoffset:16] [&_path]:[animation:error-status-draw_180ms_ease-out_120ms_forwards] motion-reduce:[&_path]:[animation:none] motion-reduce:[&_path]:[stroke-dashoffset:0]"
      icon="lucide:x"
    />
  </span>
</template>
