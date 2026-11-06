<script setup lang="ts">
import { Icon } from '@iconify/vue'
</script>

<template>
  <span class="error-status-icon" aria-hidden="true">
    <Icon class="error-status-cross" icon="lucide:x" />
  </span>
</template>

<style scoped>
.error-status-icon {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--danger-soft);
  color: var(--danger-1);
  animation: error-status-pop 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.error-status-cross {
  width: 36px;
  height: 36px;
}

.error-status-cross :deep(path) {
  stroke-dasharray: 16;
  stroke-dashoffset: 16;
  animation: error-status-draw 180ms ease-out 120ms forwards;
}

@keyframes error-status-pop {
  from {
    scale: 0.65;
    opacity: 0;
  }
  to {
    scale: 1;
    opacity: 1;
  }
}

@keyframes error-status-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .error-status-icon,
  .error-status-cross :deep(path) {
    animation: none;
    stroke-dashoffset: 0;
  }
}
</style>
