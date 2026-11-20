<script setup lang="ts">
import { Icon } from '@iconify/vue'
</script>

<template>
  <span
    class="success-status-icon grid place-items-center w-18 h-18 rounded-[50%] [background:var(--tip-soft)] text-[var(--tip-1)] [animation:success-status-pop_320ms_cubic-bezier(0.2,_0.8,_0.2,_1)_both] motion-reduce:[animation:none] motion-reduce:[stroke-dashoffset:0]"
    aria-hidden="true"
  >
    <Icon
      class="success-status-check w-9 h-9 [&_path]:[stroke-dasharray:24] [&_path]:[stroke-dashoffset:-24] [&_path]:[animation:success-status-draw_260ms_ease-out_120ms_forwards] motion-reduce:[&_path]:[animation:none] motion-reduce:[&_path]:[stroke-dashoffset:0]"
      icon="lucide:check"
    />
  </span>
</template>
