<template>
  <div
    v-if="widgetVisible"
    ref="widgetElement"
    class="group fixed right-[max(1.15rem,env(safe-area-inset-right))] bottom-[max(1.05rem,env(safe-area-inset-bottom))] z-[1100] flex h-36 w-24 items-end justify-center overflow-visible cursor-grab touch-none select-none opacity-90 transition-opacity duration-[180ms] ease-out hover:opacity-100 focus-within:opacity-100 max-[860px]:hidden motion-reduce:transition-none"
    :class="{ 'cursor-grabbing opacity-80': dragging, 'opacity-100': bubbleVisible }"
    :style="widgetStyle"
    @pointerdown="startDrag"
    @mouseenter="handlePointerEnter"
    @mouseleave="handlePointerLeave"
  >
    <button
      class="feedback-widget-close group-hover:opacity-100 group-focus-within:opacity-100"
      type="button"
      :aria-label="$t('translationFeedback.widgetClose')"
      :title="$t('translationFeedback.widgetClose')"
      @pointerdown.stop
      @click.stop="dismissWidget"
    >
      <Icon icon="lucide:x" aria-hidden="true" />
    </button>

    <TranslationFeedbackWidgetBubble :text="bubbleText" :visible="bubbleVisible" />

    <button
      class="feedback-flat-control grid h-full w-full cursor-[inherit] items-end justify-items-center border-0 bg-transparent p-0 text-inherit focus-visible:rounded-xl focus-visible:outline-2 focus-visible:outline-[var(--info-1)] focus-visible:outline-offset-3"
      type="button"
      :aria-label="$t('translationFeedback.widgetLabel')"
      aria-describedby="translation-feedback-widget-bubble"
      @click="openPage"
      @focus="handleFocus"
      @blur="handleBlur"
    >
      <MinecraftPlayerModel :key="activityRevision" :activity="activity" />
    </button>
  </div>

  <button
    v-else-if="visible"
    class="feedback-widget-restore max-[860px]:hidden"
    type="button"
    :aria-label="$t('translationFeedback.widgetRestore')"
    @click="restoreWidget"
  >
    <Icon icon="lucide:rotate-ccw" aria-hidden="true" />
    {{ $t('translationFeedback.widgetRestore') }}
  </button>
</template>

<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import MinecraftPlayerModel from '@/components/MinecraftPlayerModel.vue'
import TranslationFeedbackWidgetBubble from '@/components/TranslationFeedbackWidgetBubble.vue'
import { getTranslationFeedbackWidgetCopy } from '@/locales/translationFeedbackWidget'
import { isAprilFoolsSkippedPath } from '@/utils/aprilFools'

const DRAG_THRESHOLD = 5
const MIN_VIEWPORT_MARGIN = 8
const IDLE_DELAY = 8_000
const ACTIVITY_THROTTLE = 400
const EVENT_COOLDOWN = 1_200
const SCROLL_THROTTLE = 360
const SCROLL_SETTLE_DELAY = 320
const DISMISSED_STORAGE_KEY = 'vmct.translation-feedback-widget.dismissed'

type WidgetActivity = 'idle' | 'wave' | 'walk' | 'jump' | 'cheer' | 'point'
const ACTIVITY_DURATION: Record<Exclude<WidgetActivity, 'idle'>, number> = {
  wave: 1_350,
  walk: 2_600,
  jump: 1_200,
  cheer: 1_200,
  point: 1_500,
}

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const isMobile = useMediaQuery('(max-width: 860px)')
const storageReady = ref(false)
const isFeedbackPage = computed(() => route.path === '/translation-feedback')
const visible = computed(
  () =>
    storageReady.value &&
    !isMobile.value &&
    !isAprilFoolsSkippedPath(route.path) &&
    !isFeedbackPage.value,
)
const dismissed = ref(false)
const widgetVisible = computed(() => visible.value && !dismissed.value)
const widgetElement = ref<HTMLElement | null>(null)
const dragging = ref(false)
const suppressClick = ref(false)
const bubbleVisible = ref(false)
const bubbleText = ref('')
const activity = ref<WidgetActivity>('idle')
const activityRevision = ref(0)
const messageCount = ref(0)
const position = ref<{ x: number; y: number } | null>(null)
const widgetCopy = computed(() => getTranslationFeedbackWidgetCopy(locale.value))
const widgetMessages = computed(() => widgetCopy.value.messages.filter(Boolean))
const idleActivities = ['walk', 'jump', 'point', 'cheer'] as const
let idleActivityIndex = 0

let bubbleTimer: number | undefined
let idleTimer: number | undefined
let activityTimer: number | undefined
let scrollTimer: number | undefined
let lastActivityAt = 0
let lastEventAt = 0
let lastScrollAt = 0

const dragState = {
  pointerId: -1,
  offsetX: 0,
  offsetY: 0,
  startX: 0,
  startY: 0,
}

const widgetStyle = computed(() => {
  if (!position.value) return undefined

  return { left: `${position.value.x}px`, right: 'auto', top: `${position.value.y}px` }
})

onMounted(() => {
  window.addEventListener('resize', keepWidgetInViewport)
  window.addEventListener('pointermove', handleUserActivity, { passive: true })
  window.addEventListener('pointerdown', handleUserActivity, { passive: true })
  window.addEventListener('keydown', handleUserActivity, { passive: true })
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('online', handleOnline, { passive: true })
  document.addEventListener('visibilitychange', handleVisibilityChange)

  dismissed.value = readDismissedState()
  storageReady.value = true
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', keepWidgetInViewport)
  window.removeEventListener('pointermove', handleUserActivity)
  window.removeEventListener('pointerdown', handleUserActivity)
  window.removeEventListener('keydown', handleUserActivity)
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('online', handleOnline)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  clearTimers()
  cancelDrag()
})

watch(widgetVisible, (isVisible) => {
  if (isVisible) {
    showBubble()
    resetIdleTimer()
    return
  }

  bubbleVisible.value = false
  clearTimers()
  activity.value = 'idle'
  cancelDrag()
})

watch(
  () => route.path,
  (path, previousPath) => {
    if (path === '/translation-feedback' || previousPath === '/translation-feedback') {
      return
    }

    triggerEvent('wave', ACTIVITY_DURATION.wave, true)
  },
)

function showBubble(
  nextActivity: WidgetActivity | null = 'wave',
  duration = ACTIVITY_DURATION.wave,
) {
  const configuredMessages = widgetMessages.value
  if (messageCount.value === 0) {
    bubbleText.value = widgetCopy.value.first
  } else {
    const randomIndex = configuredMessages.length
      ? Math.floor(Math.random() * configuredMessages.length)
      : -1
    bubbleText.value = configuredMessages[randomIndex] || t('translationFeedback.widgetLabel')
  }

  messageCount.value += 1
  bubbleVisible.value = true
  window.clearTimeout(bubbleTimer)
  bubbleTimer = window.setTimeout(() => {
    bubbleVisible.value = false
  }, 4200)

  if (nextActivity) setActivity(nextActivity, duration)
}

function handlePointerEnter() {
  if (dragging.value) return
  showBubble()
  resetIdleTimer()
}

function handlePointerLeave() {
  window.clearTimeout(bubbleTimer)
  bubbleTimer = window.setTimeout(() => {
    bubbleVisible.value = false
  }, 1600)
  resetIdleTimer()
}

function handleFocus() {
  showBubble('cheer', ACTIVITY_DURATION.cheer)
  resetIdleTimer()
}

function handleBlur() {
  handlePointerLeave()
}

function handleUserActivity() {
  if (!widgetVisible.value) return

  const now = Date.now()
  if (now - lastActivityAt < ACTIVITY_THROTTLE) return

  lastActivityAt = now
  resetIdleTimer()
}

function handleScroll() {
  handleUserActivity()
  const now = Date.now()

  if (now - lastScrollAt >= SCROLL_THROTTLE) {
    lastScrollAt = now
    triggerEvent('walk', ACTIVITY_DURATION.walk)
  }

  window.clearTimeout(scrollTimer)
  scrollTimer = window.setTimeout(() => {
    lastScrollAt = 0
    resetIdleTimer()
  }, SCROLL_SETTLE_DELAY)
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    triggerEvent('wave', ACTIVITY_DURATION.wave, true)
  }
}

function handleOnline() {
  triggerEvent('cheer', ACTIVITY_DURATION.cheer, true)
}

function triggerEvent(nextActivity: WidgetActivity, duration: number, withBubble = false) {
  if (!widgetVisible.value || dragging.value) return

  const now = Date.now()
  if (now - lastEventAt < EVENT_COOLDOWN) return

  lastEventAt = now
  if (withBubble) showBubble(nextActivity, duration)
  else setActivity(nextActivity, duration)
  resetIdleTimer()
}

function resetIdleTimer() {
  window.clearTimeout(idleTimer)
  if (!widgetVisible.value) return

  idleTimer = window.setTimeout(() => {
    const nextActivity = idleActivities[idleActivityIndex]
    idleActivityIndex = (idleActivityIndex + 1) % idleActivities.length
    showBubble(null)
    setActivity(nextActivity, ACTIVITY_DURATION[nextActivity])
    resetIdleTimer()
  }, IDLE_DELAY)
}

function setActivity(nextActivity: WidgetActivity, duration: number) {
  activity.value = nextActivity
  activityRevision.value += 1
  window.clearTimeout(activityTimer)
  activityTimer = window.setTimeout(() => {
    activity.value = 'idle'
    activityRevision.value += 1
  }, duration)
}

function clearTimers() {
  window.clearTimeout(bubbleTimer)
  window.clearTimeout(idleTimer)
  window.clearTimeout(activityTimer)
  window.clearTimeout(scrollTimer)
  lastScrollAt = 0
}

function readDismissedState() {
  try {
    return window.localStorage.getItem(DISMISSED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function dismissWidget() {
  dismissed.value = true
  bubbleVisible.value = false
  activity.value = 'idle'
  clearTimers()
  cancelDrag()

  try {
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, '1')
  } catch {
    // Private browsing may disable localStorage; the in-memory dismissal still works.
  }
}

function restoreWidget() {
  dismissed.value = false

  try {
    window.localStorage.removeItem(DISMISSED_STORAGE_KEY)
  } catch {
    // Ignore storage failures and keep the widget available for this session.
  }
}

function openPage() {
  if (suppressClick.value) {
    suppressClick.value = false
    return
  }

  void router.push('/translation-feedback')
}

function startDrag(event: PointerEvent) {
  if (event.button !== 0 || event.isPrimary === false) return

  const element = widgetElement.value
  if (!element) return

  const bounds = element.getBoundingClientRect()
  stopPointerTracking()
  dragState.pointerId = event.pointerId
  dragState.offsetX = event.clientX - bounds.left
  dragState.offsetY = event.clientY - bounds.top
  dragState.startX = event.clientX
  dragState.startY = event.clientY
  window.addEventListener('pointermove', moveDrag, { passive: false })
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
}

function moveDrag(event: PointerEvent) {
  if (event.pointerId !== dragState.pointerId) return

  if (!dragging.value) {
    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY)
    if (distance < DRAG_THRESHOLD) return

    const element = widgetElement.value
    if (!element) return

    const bounds = element.getBoundingClientRect()
    position.value = { x: bounds.left, y: bounds.top }
    dragging.value = true
    suppressClick.value = true
    bubbleVisible.value = false
  }

  const element = widgetElement.value
  if (!element) return

  event.preventDefault()
  const bounds = element.getBoundingClientRect()
  position.value = {
    x: clamp(
      event.clientX - dragState.offsetX,
      MIN_VIEWPORT_MARGIN,
      window.innerWidth - bounds.width - MIN_VIEWPORT_MARGIN,
    ),
    y: clamp(
      event.clientY - dragState.offsetY,
      MIN_VIEWPORT_MARGIN,
      window.innerHeight - bounds.height - MIN_VIEWPORT_MARGIN,
    ),
  }
}

function endDrag(event: PointerEvent) {
  if (event.pointerId !== dragState.pointerId) return

  stopPointerTracking()
  if (dragging.value) {
    dragging.value = false
    triggerEvent('cheer', ACTIVITY_DURATION.cheer)
    window.setTimeout(() => {
      suppressClick.value = false
    }, 0)
  } else {
    suppressClick.value = false
  }
  dragState.pointerId = -1
}

function stopPointerTracking() {
  window.removeEventListener('pointermove', moveDrag)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
}

function cancelDrag() {
  stopPointerTracking()
  dragging.value = false
  suppressClick.value = false
  dragState.pointerId = -1
}

function keepWidgetInViewport() {
  if (!position.value || !widgetElement.value) return

  const bounds = widgetElement.value.getBoundingClientRect()
  position.value = {
    x: clamp(
      position.value.x,
      MIN_VIEWPORT_MARGIN,
      window.innerWidth - bounds.width - MIN_VIEWPORT_MARGIN,
    ),
    y: clamp(
      position.value.y,
      MIN_VIEWPORT_MARGIN,
      window.innerHeight - bounds.height - MIN_VIEWPORT_MARGIN,
    ),
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
}
</script>
