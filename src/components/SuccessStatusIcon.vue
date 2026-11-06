<script setup lang="ts">
import { Icon } from '@iconify/vue'
</script>

<template>
  <span class="success-status-icon" aria-hidden="true">
    <Icon class="success-status-check" icon="lucide:check" />
  </span>
</template>

<style scoped>
.success-status-icon {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--tip-soft);
  color: var(--tip-1);
  animation: success-status-pop 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.success-status-check {
  width: 36px;
  height: 36px;
}

.success-status-check :deep(path) {
  stroke-dasharray: 24;
  stroke-dashoffset: -24;
  animation: success-status-draw 260ms ease-out 120ms forwards;
}

@keyframes success-status-pop {
  from {
    scale: 0.65;
    opacity: 0;
  }
  to {
    scale: 1;
    opacity: 1;
  }
}

@keyframes success-status-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .success-status-icon,
  .success-status-check :deep(path) {
    animation: none;
    stroke-dashoffset: 0;
  }
}
</style>
