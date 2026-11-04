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
}

.success-status-check {
  width: 36px;
  height: 36px;
}
</style>
