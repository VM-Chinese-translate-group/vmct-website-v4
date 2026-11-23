<template>
  <div
    ref="rootRef"
    class="select-menu relative z-[1] w-[var(--select-width,_180px)] min-w-0 [&.open]:z-[20]"
    :class="{ open: isOpen, flat: variant === 'flat' }"
  >
    <button
      type="button"
      class="select-menu-trigger flex items-center justify-between box-border w-full h-[38px] gap-[10px] p-[0_11px_0_12px] text-[var(--text-1)] appearance-none font-inherit [font-weight:inherit] [line-height:inherit] text-[14px] text-left cursor-pointer [background:var(--bg-alt)] [border:1px_solid_var(--switcher-border)] rounded-lg [transition:border-color_0.15s_ease,_box-shadow_0.15s_ease,_background-color_0.15s_ease] [.select-menu.flat_&]:[box-shadow:none]! [.select-menu.flat_&]:[background-image:none]! [.select-menu.flat_&:focus-visible]:[box-shadow:none]! [.select-menu.flat_&:focus-visible]:[background-image:none]! [.select-menu.flat_&:focus-visible]:[outline:2px_solid_var(--info-1)]! [.select-menu.flat_&:focus-visible]:[outline-offset:2px] [.select-menu.flat.open_&]:[box-shadow:none]! [.select-menu.flat.open_&]:[background-image:none]! hover:border-[color-mix(in_srgb,_var(--btn-primary-bg)_55%,_var(--switcher-border))] focus-visible:[outline:none] focus-visible:border-[var(--btn-primary-bg)] focus-visible:[box-shadow:0_0_0_2px_var(--nav-shadow)] [.open_&]:[outline:none] [.open_&]:border-[var(--btn-primary-bg)] [.open_&]:[box-shadow:0_0_0_2px_var(--nav-shadow)] motion-reduce:[transition:none]"
      :class="[
        { 'has-icons [.select-menu-option&]:grid-cols-[auto_minmax(0,_1fr)_16px]': hasOptionIcons },
        variant === 'flat'
          ? ['feedback-select-trigger', isOpen ? 'border-[var(--info-1)]!' : '']
          : '',
      ]"
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
        class="select-menu-icon vm-select-select-menu-icon"
        aria-hidden="true"
      />
      <img
        v-else-if="selectedOption?.icon"
        :src="selectedOption.icon"
        class="select-menu-icon vm-select-select-menu-icon"
        alt=""
      />
      <span
        v-else-if="hasOptionIcons"
        class="select-menu-icon vm-select-select-menu-icon"
        aria-hidden="true"
      ></span>
      <span class="select-menu-value min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {{ selectedOption?.label }}
      </span>
      <Icon
        icon="lucide:chevron-down"
        class="select-menu-chevron w-4 h-4 flex-none text-[var(--text-muted)] [transition:transform_0.18s_ease] [.open_&]:[transform:rotate(180deg)] motion-reduce:[transition:none]"
        aria-hidden="true"
      />
    </button>

    <Transition name="select-menu-pop">
      <div
        v-if="isOpen"
        class="select-menu-options absolute [top:calc(100%_+_6px)] [right:0] box-border w-[max(100%,_var(--select-menu-min-width,_180px))] p-[5px] overflow-hidden [background:var(--bg-alt)] [border:1px_solid_var(--switcher-border)] rounded-lg [box-shadow:var(--switcher-shadow)]"
        role="listbox"
        :aria-label="ariaLabel"
      >
        <button
          v-for="(option, index) in options"
          :key="option.value"
          type="button"
          class="select-menu-option [.select-menu.flat_&]:appearance-none! [.select-menu.flat_&]:[box-shadow:none]! [.select-menu.flat_&]:[background-image:none]! [.select-menu.flat_&:focus-visible]:appearance-none! [.select-menu.flat_&:focus-visible]:[box-shadow:none]! [.select-menu.flat_&:focus-visible]:[background-image:none]! grid grid-cols-[minmax(0,_1fr)_16px] items-center box-border w-full min-h-[36px] gap-3 p-[8px_10px] text-[var(--text-1)] font-inherit [font-weight:inherit] text-[14px] leading-[1.35] text-left cursor-pointer [background:transparent] border-0 rounded-md [&_>_span]:min-w-0 [&_>_span]:overflow-hidden [&_>_span]:text-ellipsis [&_>_span]:whitespace-nowrap hover:[outline:none] hover:[background:var(--switcher-item-hover)] focus-visible:[outline:none] focus-visible:[background:var(--switcher-item-hover)] [&.selected]:text-[var(--info-1)] [&.selected]:font-600 [&.selected]:[background:var(--info-soft)]"
          :class="{
            selected: option.value === modelValue,
            'has-icons [.select-menu-option&]:grid-cols-[auto_minmax(0,_1fr)_16px]': hasOptionIcons,
          }"
          role="option"
          :aria-selected="option.value === modelValue"
          @click="selectOption(option.value)"
          @keydown="handleOptionKeydown($event, index)"
        >
          <Icon
            v-if="option.icon?.startsWith('lucide:')"
            :icon="option.icon"
            class="select-menu-icon vm-select-select-menu-icon"
            aria-hidden="true"
          />
          <img
            v-else-if="option.icon"
            :src="option.icon"
            class="select-menu-icon vm-select-select-menu-icon"
            alt=""
          />
          <span
            v-else-if="hasOptionIcons"
            class="select-menu-icon vm-select-select-menu-icon"
            aria-hidden="true"
          ></span>
          <span>{{ option.label }}</span>
          <Icon
            v-if="option.value === modelValue"
            icon="lucide:check"
            class="select-menu-check w-4 h-4 text-[currentColor]"
            aria-hidden="true"
          />
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts" generic="T extends string | number">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { Icon } from '@/icons'

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
const hasOptionIcons = computed(() => props.options.some((option) => Boolean(option.icon)))

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
