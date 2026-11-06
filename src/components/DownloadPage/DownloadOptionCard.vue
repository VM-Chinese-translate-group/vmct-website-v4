<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
  icon?: string
  disabled?: boolean
}>()

const emit = defineEmits<{ select: [] }>()
</script>

<template>
  <button type="button" class="download-option-card" :disabled="disabled" @click="emit('select')">
    <span v-if="icon" class="download-option-art" aria-hidden="true">
      <span v-if="icon.startsWith('i')" :class="[icon, 'download-option-icon']" />
      <img v-else :src="icon" alt="" />
    </span>
    <span class="download-option-copy">
      <strong class="download-option-title">{{ title }}</strong>
      <span v-if="description || $slots.description" class="download-option-description">
        <slot name="description">{{ description }}</slot>
      </span>
    </span>
    <svg
      class="download-option-arrow"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12h16m-7-7 7 7-7 7" />
    </svg>
  </button>
</template>
