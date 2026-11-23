<template>
  <Teleport to="#vmct-overlays">
    <Transition name="base-dialog" @after-enter="emit('opened')" @after-leave="afterLeave">
      <div
        v-if="open"
        class="base-dialog-overlay fixed [inset:0] grid box-border place-items-center grid-cols-[minmax(0,_1fr)] p-5 [background:rgb(0_0_0_/_58%)] max-[600px]:p-3"
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
          class="base-dialog-panel grid box-border grid-rows-[auto_minmax(0,_1fr)_auto] w-[min(var(--base-dialog-width),_100%)] min-w-0 max-h-[calc(100dvh_-_40px)] m-0 overflow-hidden [border:1px_solid_var(--switcher-border)] rounded-2xl [background:var(--bg-white)] text-[var(--text-1)] [color-scheme:light] [box-shadow:var(--card-shadow)] dark:[color-scheme:dark] [.base-dialog-enter-active_&]:[transition:transform_0.18s_ease] [.base-dialog-enter-active_&]:[will-change:transform] [.base-dialog-leave-active_&]:[transition:transform_0.18s_ease] [.base-dialog-leave-active_&]:[will-change:transform] [.base-dialog-enter-from_&]:[transform:translateY(-10px)] [.base-dialog-leave-to_&]:[transform:translateY(-10px)] max-[600px]:max-h-[calc(100dvh_-_24px)] motion-reduce:[.base-dialog-enter-active_&]:[transition:none] motion-reduce:[.base-dialog-leave-active_&]:[transition:none]"
          :role="role"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="description || slots.description ? descriptionId : undefined"
          tabindex="-1"
        >
          <header
            class="base-dialog-header flex items-center justify-between gap-4 p-[20px_24px_16px] max-[600px]:p-[16px_20px]"
          >
            <div class="base-dialog-heading min-w-0">
              <h2
                :id="titleId"
                class="base-dialog-title m-0 text-[var(--text-dark)] text-[1.35rem] font-700"
              >
                <slot name="title">{{ title }}</slot>
              </h2>
              <p
                v-if="description || slots.description"
                :id="descriptionId"
                class="base-dialog-description m-[8px_0_0] text-[var(--text-2)] text-[14px] leading-[1.6]"
              >
                <slot name="description">{{ description }}</slot>
              </p>
            </div>
            <button
              v-if="showClose"
              ref="closeButtonRef"
              class="base-dialog-close grid w-11 h-11 flex-none place-items-center appearance-none border-0 rounded-[10px] p-0 [background:transparent] text-[var(--text-2)] font-inherit [font-weight:inherit] [line-height:inherit] [box-shadow:none] cursor-pointer [transition:background-color_160ms_ease,_color_160ms_ease] [&_svg]:w-5 [&_svg]:h-5 hover:[background:var(--bg-soft)] hover:text-[var(--text-dark)] focus-visible:[outline:2px_solid_var(--info-1)] focus-visible:[outline-offset:2px] motion-reduce:[transition:none]"
              type="button"
              :aria-label="closeLabel"
              @click="requestClose('close-button')"
            >
              <Icon icon="lucide:x" aria-hidden="true" />
            </button>
          </header>

          <div
            class="base-dialog-body min-h-0 overflow-y-auto overscroll-contain p-[0_24px_24px] [scroll-padding-block:12px] max-[600px]:p-[0_20px_20px]"
          >
            <slot :close="close" />
          </div>
          <footer
            v-if="slots.footer"
            class="base-dialog-footer grid gap-3 p-6 [border-top:1px_solid_var(--switcher-border)] [background:var(--bg-soft)] [&_.base-dialog-actions]:grid [&_.base-dialog-actions]:[grid-auto-flow:column] [&_.base-dialog-actions]:[grid-auto-columns:minmax(0,_160px)] [&_.base-dialog-actions]:justify-center [&_.base-dialog-actions]:gap-2 [&_.base-dialog-actions]:w-full [&_.base-dialog-actions_>_button]:box-border [&_.base-dialog-actions_>_button]:inline-flex [&_.base-dialog-actions_>_button]:items-center [&_.base-dialog-actions_>_button]:justify-center [&_.base-dialog-actions_>_button]:min-w-0 [&_.base-dialog-actions_>_button]:h-11 [&_.base-dialog-actions_>_button]:min-h-[44px] [&_.base-dialog-actions_>_button]:py-0 max-[600px]:p-[24px_20px]"
          >
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
import { Icon } from '@/icons'
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
