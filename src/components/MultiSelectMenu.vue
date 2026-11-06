<template>
  <div
    ref="rootRef"
    class="relative min-w-0 w-full"
    :class="{ 'z-30': isOpen }"
    @focusout="handleFocusOut"
    @keydown.esc="handleEscape"
  >
    <button
      ref="triggerRef"
      type="button"
      class="feedback-select-trigger multi-select-trigger box-border flex w-full cursor-pointer items-center gap-2 border border-solid text-left font-inherit text-sm text-[var(--text-dark)]"
      :class="isOpen ? 'border-[var(--info-1)]!' : ''"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-controls="isOpen ? menuId : undefined"
      :aria-label="ariaLabel"
      :aria-describedby="summaryId"
      @click="toggleMenu"
      @keydown.down.prevent="openMenu()"
      @keydown.up.prevent="openMenu(true)"
    >
      <span :id="summaryId" class="sr-only">{{ summary }}</span>
      <span class="multi-select-tags" aria-hidden="true">
        <span v-for="option in selectedOptions" :key="option.value" class="multi-select-tag">
          {{ option.label }}
        </span>
        <span v-if="!selectedOptions.length" class="text-[var(--text-muted)]">
          {{ placeholder }}
        </span>
      </span>
      <Icon
        class="size-4 shrink-0 text-[var(--text-muted)] transition-transform motion-reduce:transition-none"
        :class="{ 'rotate-180': isOpen }"
        icon="lucide:chevron-down"
        aria-hidden="true"
      />
    </button>

    <Transition name="multi-select-menu">
      <div
        v-if="isOpen"
        :id="menuId"
        ref="menuRef"
        class="multi-select-options"
        :style="menuStyle"
        role="listbox"
        aria-multiselectable="true"
        :aria-label="ariaLabel"
      >
        <button
          v-for="(option, index) in options"
          :key="option.value"
          class="feedback-flat-control multi-select-option"
          type="button"
          role="option"
          tabindex="-1"
          :aria-selected="modelValue.includes(option.value)"
          @click="toggleOption(option.value)"
          @keydown="handleOptionKeydown($event, index)"
        >
          <span class="multi-select-checkbox" aria-hidden="true">
            <Icon v-if="modelValue.includes(option.value)" class="size-3.5" icon="lucide:check" />
          </span>
          <span class="min-w-0 [overflow-wrap:anywhere]">{{ option.label }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts" generic="T extends string | number">
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { Icon } from '@iconify/vue'

const props = defineProps<{
  ariaLabel: string
  placeholder: string
  modelValue: readonly T[]
  options: readonly { label: string; value: T }[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: T[]] }>()
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const menuStyle = ref<CSSProperties>({})
const menuId = `${useId()}-options`
const summaryId = `${menuId}-summary`
const selectedOptions = computed(() =>
  props.options.filter((option) => props.modelValue.includes(option.value)),
)
const selectedLabels = computed(() => selectedOptions.value.map((option) => option.label))
const summary = computed(() => selectedLabels.value.join(', ') || props.placeholder)

function positionMenu() {
  if (!isOpen.value || !triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const below = Math.max(0, window.innerHeight - rect.bottom - 18)
  const above = Math.max(0, rect.top - 18)
  const desiredHeight = Math.min(280, props.options.length * 44 + 10)
  const opensAbove = below < desiredHeight && above > below
  menuStyle.value = {
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    top: opensAbove ? 'auto' : `${rect.bottom + 6}px`,
    bottom: opensAbove ? `${window.innerHeight - rect.top + 6}px` : 'auto',
    maxHeight: `${Math.min(280, opensAbove ? above : below)}px`,
  }
}

async function focusOption(index: number) {
  await nextTick()
  const menu = menuRef.value
  const option = menu?.querySelectorAll<HTMLButtonElement>('[role="option"]')[index]
  if (!menu || !option) return
  option.focus({ preventScroll: true })
  if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop
  else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight) {
    menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight
  }
}

function openMenu(last = false) {
  if (isOpen.value) return
  isOpen.value = true
  positionMenu()
  const selected = props.options.findIndex((option) => props.modelValue.includes(option.value))
  void focusOption(last ? props.options.length - 1 : Math.max(0, selected))
}

function closeMenu(restoreFocus = false) {
  if (!isOpen.value) return
  isOpen.value = false
  if (restoreFocus) void nextTick(() => triggerRef.value?.focus({ preventScroll: true }))
}

function toggleMenu() {
  if (isOpen.value) closeMenu()
  else openMenu()
}

function toggleOption(value: T) {
  emit(
    'update:modelValue',
    props.modelValue.includes(value)
      ? props.modelValue.filter((entry) => entry !== value)
      : [...props.modelValue, value],
  )
}

function handleEscape(event: KeyboardEvent) {
  if (!isOpen.value) return
  event.preventDefault()
  event.stopPropagation()
  closeMenu(true)
}

function handleOptionKeydown(event: KeyboardEvent, index: number) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      void focusOption((index + 1) % props.options.length)
      break
    case 'ArrowUp':
      event.preventDefault()
      void focusOption((index - 1 + props.options.length) % props.options.length)
      break
    case 'Home':
      event.preventDefault()
      void focusOption(0)
      break
    case 'End':
      event.preventDefault()
      void focusOption(props.options.length - 1)
      break
    case ' ':
    case 'Enter':
      event.preventDefault()
      toggleOption(props.options[index].value)
      break
    case 'Escape':
      handleEscape(event)
      break
    case 'Tab':
      if (event.shiftKey) {
        event.preventDefault()
        closeMenu(true)
      }
      break
  }
}

function handleFocusOut(event: FocusEvent) {
  if (!rootRef.value?.contains(event.relatedTarget as Node | null)) closeMenu()
}

function handleOutsidePointerDown(event: PointerEvent) {
  if (!rootRef.value?.contains(event.target as Node)) closeMenu()
}

function handleScroll(event: Event) {
  if (!menuRef.value?.contains(event.target as Node)) closeMenu()
}

watch(
  () => props.options,
  () => closeMenu(),
)
watch(
  () => props.modelValue,
  () => {
    if (isOpen.value) void nextTick(positionMenu)
  },
)
onMounted(() => {
  document.addEventListener('pointerdown', handleOutsidePointerDown)
  window.addEventListener('resize', positionMenu)
  window.addEventListener('scroll', handleScroll, true)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', handleOutsidePointerDown)
  window.removeEventListener('resize', positionMenu)
  window.removeEventListener('scroll', handleScroll, true)
})
</script>

<style scoped>
@import '@/styles/MultiSelectMenu.css';
</style>
