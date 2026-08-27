<template>
  <div ref="rootRef" class="select-menu" :class="{ open: isOpen, flat: variant === 'flat' }">
    <button
      type="button"
      class="select-menu-trigger"
      :class="
        variant === 'flat'
          ? ['feedback-select-trigger', isOpen ? 'border-[var(--info-1)]!' : '']
          : ''
      "
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-label="ariaLabel"
      @click="toggleMenu"
      @keydown.down.prevent="openMenu('selected')"
      @keydown.up.prevent="openMenu('last')"
    >
      <Icon
        v-if="selectedOption?.icon?.startsWith('lucide:')"
        :icon="selectedOption.icon"
        class="select-menu-icon"
        aria-hidden="true"
      />
      <img
        v-else-if="selectedOption?.icon"
        :src="selectedOption.icon"
        class="select-menu-icon"
        alt=""
      />
      <span v-else class="select-menu-icon" aria-hidden="true"></span>
      <span class="select-menu-value">{{ selectedOption?.label }}</span>
      <Icon icon="lucide:chevron-down" class="select-menu-chevron" aria-hidden="true" />
    </button>

    <Transition name="select-menu-pop">
      <div v-if="isOpen" class="select-menu-options" role="listbox" :aria-label="ariaLabel">
        <button
          v-for="(option, index) in options"
          :key="option.value"
          type="button"
          class="select-menu-option"
          :class="{ selected: option.value === modelValue }"
          role="option"
          :aria-selected="option.value === modelValue"
          @click="selectOption(option.value)"
          @keydown="handleOptionKeydown($event, index)"
        >
          <Icon
            v-if="option.icon?.startsWith('lucide:')"
            :icon="option.icon"
            class="select-menu-icon"
            aria-hidden="true"
          />
          <img v-else-if="option.icon" :src="option.icon" class="select-menu-icon" alt="" />
          <span v-else class="select-menu-icon" aria-hidden="true"></span>
          <span>{{ option.label }}</span>
          <Icon
            v-if="option.value === modelValue"
            icon="lucide:check"
            class="select-menu-check"
            aria-hidden="true"
          />
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts" generic="T extends string | number">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { Icon } from '@iconify/vue'

interface SelectOption<T> {
  label: string
  value: T
  icon?: string
}

const props = defineProps<{
  ariaLabel: string
  modelValue: T
  options: readonly SelectOption<T>[]
  variant?: 'default' | 'flat'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: T]
}>()

const rootRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)

const selectedOption = computed(() =>
  props.options.find((option) => option.value === props.modelValue),
)

function getOptionElements() {
  return Array.from(rootRef.value?.querySelectorAll<HTMLButtonElement>('.select-menu-option') ?? [])
}

async function focusOption(index: number) {
  await nextTick()
  const optionElements = getOptionElements()
  optionElements[Math.max(0, Math.min(index, optionElements.length - 1))]?.focus()
}

function openMenu(focus: 'selected' | 'last' = 'selected') {
  if (isOpen.value) return
  isOpen.value = true

  const selectedIndex = props.options.findIndex((option) => option.value === props.modelValue)
  void focusOption(focus === 'last' ? props.options.length - 1 : Math.max(selectedIndex, 0))
}

function closeMenu({ restoreFocus = false } = {}) {
  if (!isOpen.value) return
  isOpen.value = false
  if (restoreFocus) {
    void nextTick(() =>
      rootRef.value?.querySelector<HTMLButtonElement>('.select-menu-trigger')?.focus(),
    )
  }
}

function toggleMenu() {
  if (isOpen.value) closeMenu()
  else openMenu()
}

function selectOption(value: T) {
  emit('update:modelValue', value)
  closeMenu({ restoreFocus: true })
}

function handleOptionKeydown(event: KeyboardEvent, index: number) {
  const optionElements = getOptionElements()

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      optionElements[(index + 1) % optionElements.length]?.focus()
      break
    case 'ArrowUp':
      event.preventDefault()
      optionElements[(index - 1 + optionElements.length) % optionElements.length]?.focus()
      break
    case 'Home':
      event.preventDefault()
      optionElements[0]?.focus()
      break
    case 'End':
      event.preventDefault()
      optionElements.at(-1)?.focus()
      break
    case 'Escape':
      event.preventDefault()
      closeMenu({ restoreFocus: true })
      break
    case 'Tab':
      closeMenu()
      break
  }
}

function handleOutsidePointerDown(event: PointerEvent) {
  if (!rootRef.value?.contains(event.target as Node)) closeMenu()
}

onMounted(() => document.addEventListener('pointerdown', handleOutsidePointerDown))
onUnmounted(() => document.removeEventListener('pointerdown', handleOutsidePointerDown))
</script>

<style scoped>
.select-menu {
  position: relative;
  z-index: 1;
  width: var(--select-width, 180px);
  min-width: 0;
}

.select-menu.open {
  z-index: 20;
}

.select-menu-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  width: 100%;
  height: 38px;
  gap: 10px;
  padding: 0 11px 0 12px;
  color: var(--text-1);
  appearance: none;
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  background: var(--bg-alt);
  border: 1px solid var(--switcher-border);
  border-radius: 8px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background-color 0.15s ease;
}

.select-menu.flat .select-menu-trigger,
.select-menu.flat .select-menu-trigger:focus-visible,
.select-menu.flat.open .select-menu-trigger {
  box-shadow: none !important;
  background-image: none !important;
}

.select-menu.flat .select-menu-trigger:focus-visible {
  outline: 2px solid var(--info-1) !important;
  outline-offset: 2px;
}

.select-menu.flat .select-menu-option,
.select-menu.flat .select-menu-option:focus-visible {
  appearance: none !important;
  box-shadow: none !important;
  background-image: none !important;
}

.select-menu-trigger:hover {
  border-color: color-mix(in srgb, var(--btn-primary-bg) 55%, var(--switcher-border));
}

.select-menu-trigger:focus-visible,
.open .select-menu-trigger {
  outline: none;
  border-color: var(--btn-primary-bg);
  box-shadow: 0 0 0 2px var(--nav-shadow);
}

.select-menu-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-menu-icon {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  object-fit: contain;
}

.select-menu-chevron {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  color: var(--text-muted);
  transition: transform 0.18s ease;
}

.open .select-menu-chevron {
  transform: rotate(180deg);
}

.select-menu-options {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  box-sizing: border-box;
  width: max(100%, var(--select-menu-min-width, 180px));
  padding: 5px;
  overflow: hidden;
  background: var(--bg-alt);
  border: 1px solid var(--switcher-border);
  border-radius: 8px;
  box-shadow: var(--switcher-shadow);
}

.select-menu-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 16px;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  min-height: 36px;
  gap: 12px;
  padding: 8px 10px;
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 6px;
}

.select-menu-option:hover,
.select-menu-option:focus-visible {
  outline: none;
  background: var(--switcher-item-hover);
}

.select-menu-option.selected {
  color: var(--info-1);
  font-weight: 600;
  background: var(--info-soft);
}

.select-menu-check {
  width: 16px;
  height: 16px;
  color: currentColor;
}

.select-menu-pop-enter-active,
.select-menu-pop-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
  transform-origin: top right;
}

.select-menu-pop-enter-from,
.select-menu-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .select-menu-trigger,
  .select-menu-chevron,
  .select-menu-pop-enter-active,
  .select-menu-pop-leave-active {
    transition: none;
  }
}
</style>
