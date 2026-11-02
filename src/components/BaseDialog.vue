<template>
  <Teleport to="#vmct-overlays">
    <Transition name="base-dialog" @after-enter="emit('opened')" @after-leave="afterLeave">
      <div
        v-if="open"
        class="base-dialog-overlay"
        :style="{ '--base-dialog-width': width, zIndex }"
        :inert="inactive"
        :aria-hidden="inactive ? true : undefined"
        role="presentation"
        @pointerdown="handleBackdropPointerDown"
        @click.self="handleBackdropClick"
      >
        <component
          :is="as"
          v-bind="$attrs"
          :id="dialogId"
          ref="panelRef"
          class="base-dialog-panel"
          :role="role"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="description || slots.description ? descriptionId : undefined"
          tabindex="-1"
        >
          <header class="base-dialog-header">
            <div class="base-dialog-heading">
              <h2 :id="titleId" class="base-dialog-title">
                <slot name="title">{{ title }}</slot>
              </h2>
              <p
                v-if="description || slots.description"
                :id="descriptionId"
                class="base-dialog-description"
              >
                <slot name="description">{{ description }}</slot>
              </p>
            </div>
            <button
              v-if="showClose"
              ref="closeButtonRef"
              class="base-dialog-close"
              type="button"
              :aria-label="closeLabel"
              @click="requestClose('close-button')"
            >
              <Icon icon="lucide:x" aria-hidden="true" />
            </button>
          </header>

          <div class="base-dialog-body">
            <slot :close="close" />
          </div>
          <footer v-if="slots.footer" class="base-dialog-footer">
            <slot name="footer" :close="close" />
          </footer>
        </component>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  useSlots,
  watch,
} from 'vue'
import { Icon } from '@iconify/vue'
import { useDialogLayer } from '@/composables/useDialogLayer'

defineOptions({ inheritAttrs: false })
type CloseReason = 'close-button' | 'escape' | 'backdrop' | 'action'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    closeLabel: string
    id?: string
    description?: string
    width?: string
    as?: 'section' | 'form'
    role?: 'dialog' | 'alertdialog'
    showClose?: boolean
    closeOnEscape?: boolean
    closeOnBackdrop?: boolean
    initialFocus?: string
    returnFocus?: string
  }>(),
  {
    description: '',
    width: '550px',
    as: 'section',
    role: 'dialog',
    showClose: true,
    closeOnEscape: true,
    closeOnBackdrop: true,
  },
)
const emit = defineEmits<{
  'update:open': [open: boolean]
  close: [reason: CloseReason]
  opened: []
  closed: []
}>()
const slots = useSlots()
const generatedId = `dialog-${useId()}`
const dialogId = computed(() => props.id || generatedId)
const titleId = computed(() => `${dialogId.value}-title`)
const descriptionId = computed(() => `${dialogId.value}-description`)
const panelRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)
const { isTop, zIndex, activate, deactivate } = useDialogLayer()
const mounted = ref(false)
// Apply stack isolation after hydration; initially-open SSR markup must remain interactive.
const inactive = computed(() => !props.open || (mounted.value && !isTop.value))
let previousFocus: HTMLElement | null = null
let pointerStartedOnBackdrop = false
let disposed = false
let restorePending = false

const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex], [contenteditable="true"]'

function focusableElements() {
  return Array.from(panelRef.value?.querySelectorAll<HTMLElement>(focusableSelector) ?? []).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.closest('[inert], [hidden]') &&
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== 'hidden',
  )
}

function focusInitial() {
  const panel = panelRef.value
  if (!props.open || !isTop.value || !panel) return
  const requested = panel.querySelector<HTMLElement>(props.initialFocus || '[autofocus]')
  const target = requested && !requested.matches(':disabled') ? requested : null
  ;(target || closeButtonRef.value || focusableElements()[0] || panel).focus({
    preventScroll: true,
  })
}

function restoreFocus() {
  const previous = previousFocus
  previousFocus = null
  void nextTick(() => {
    if (props.open && !disposed) return
    const target = props.returnFocus
      ? document.querySelector<HTMLElement>(props.returnFocus)
      : previous
    if (target?.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true })
  })
}

function openDialog() {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
  if (!activate()) return
  restorePending = false
  previousFocus = previous
  void nextTick(focusInitial)
}

function releaseDialog() {
  if (isTop.value) restorePending = true
  deactivate()
  if (!restorePending) previousFocus = null
}

function restoreAfterClose() {
  if (!restorePending) return
  restorePending = false
  restoreFocus()
}

function afterLeave() {
  restoreAfterClose()
  emit('closed')
}

function requestClose(reason: CloseReason) {
  if (!props.open || !isTop.value) return
  emit('update:open', false)
  emit('close', reason)
}

function close() {
  requestClose('action')
}

function handleBackdropPointerDown(event: PointerEvent) {
  pointerStartedOnBackdrop = event.target === event.currentTarget
}

function handleBackdropClick() {
  if (pointerStartedOnBackdrop && props.closeOnBackdrop) requestClose('backdrop')
  pointerStartedOnBackdrop = false
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.open || !isTop.value || event.defaultPrevented) return
  if (event.key === 'Escape') {
    event.preventDefault()
    if (props.closeOnEscape) requestClose('escape')
    return
  }
  if (event.key !== 'Tab') return
  const elements = focusableElements()
  const first = elements[0]
  const last = elements.at(-1)
  if (!first || !last) {
    event.preventDefault()
    panelRef.value?.focus({ preventScroll: true })
    return
  }
  const active = document.activeElement
  const outside = !panelRef.value?.contains(active)
  if (event.shiftKey && (active === first || outside)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault()
    first.focus()
  }
}

function handleFocusIn(event: FocusEvent) {
  if (props.open && isTop.value && !panelRef.value?.contains(event.target as Node)) focusInitial()
}

watch(
  () => props.open,
  (open) => {
    if (open) openDialog()
    else releaseDialog()
  },
  { flush: 'pre' },
)

onBeforeMount(() => {
  if (props.open) openDialog()
})

onMounted(() => {
  mounted.value = true
  window.addEventListener('keydown', handleKeydown)
  document.addEventListener('focusin', handleFocusIn)
})
onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('focusin', handleFocusIn)
  releaseDialog()
  restoreAfterClose()
})
</script>

<style scoped>
.base-dialog-overlay {
  position: fixed;
  inset: 0;
  display: grid;
  box-sizing: border-box;
  place-items: center;
  grid-template-columns: minmax(0, 1fr);
  padding: 20px;
  background: rgb(0 0 0 / 58%);
  backdrop-filter: blur(4px);
}

.base-dialog-panel {
  /* Do not transform this panel: fixed-position select menus use viewport coordinates. */
  display: grid;
  box-sizing: border-box;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(var(--base-dialog-width), 100%);
  min-width: 0;
  max-height: calc(100dvh - 40px);
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--switcher-border);
  border-radius: 16px;
  background: var(--bg-white);
  color: var(--text-1);
  color-scheme: light;
  box-shadow: var(--card-shadow);
}

:global(.dark) .base-dialog-panel {
  color-scheme: dark;
}

.base-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 16px;
}

.base-dialog-heading {
  min-width: 0;
}
.base-dialog-title {
  margin: 0;
  color: var(--text-dark);
  font-size: 1.35rem;
  font-weight: 700;
}
.base-dialog-description {
  margin: 8px 0 0;
  color: var(--text-2);
  font-size: 14px;
  line-height: 1.6;
}

.base-dialog-close {
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  place-items: center;
  appearance: none;
  border: 0;
  border-radius: 10px;
  padding: 0;
  background: transparent;
  color: var(--text-2);
  font: inherit;
  box-shadow: none;
  cursor: pointer;
  transition:
    background-color 160ms ease,
    color 160ms ease;
}
.base-dialog-close svg {
  width: 20px;
  height: 20px;
}
.base-dialog-close:hover {
  background: var(--bg-soft);
  color: var(--text-dark);
}
.base-dialog-close:focus-visible {
  outline: 2px solid var(--info-1);
  outline-offset: 2px;
}

.base-dialog-body {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 24px 24px;
  scroll-padding-block: 12px;
}
.base-dialog-footer {
  display: grid;
  gap: 12px;
  padding: 16px 24px;
  background: var(--bg-soft);
}
.base-dialog-enter-active,
.base-dialog-leave-active {
  transition: opacity 160ms ease;
}
.base-dialog-enter-from,
.base-dialog-leave-to {
  opacity: 0;
}

@media (max-width: 600px) {
  .base-dialog-overlay {
    padding: 12px;
  }
  .base-dialog-panel {
    max-height: calc(100dvh - 24px);
  }
  .base-dialog-header {
    padding: 16px 20px;
  }
  .base-dialog-body {
    padding: 0 20px 20px;
  }
  .base-dialog-footer {
    padding: 16px 20px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .base-dialog-close,
  .base-dialog-enter-active,
  .base-dialog-leave-active {
    transition: none;
  }
}
</style>
