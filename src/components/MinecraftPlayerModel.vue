<template>
  <span class="relative block h-36 w-24 pointer-events-none" aria-hidden="true">
    <img
      v-show="!modelReady"
      class="absolute bottom-3 left-1/2 block h-26 w-13 -translate-x-1/2 [image-rendering:pixelated]"
      src="/imgs/wulian233-front.png"
      alt=""
      width="16"
      height="32"
    />
    <canvas
      ref="canvas"
      class="block h-full w-full [filter:drop-shadow(1px_1.5px_0_rgb(15_23_42_/_0.18))]"
      :class="{ invisible: !modelReady }"
      @webglcontextlost="modelReady = false"
      @webglcontextrestored="restoreModel"
    />
  </span>
</template>

<script setup lang="ts">
import { useEventListener, useMediaQuery } from '@vueuse/core'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PlayerAnimation, SkinViewer } from 'skinview3d'

const MAX_LOOK_ANGLE = Math.PI / 6
const REST_BODY_YAW = -0.22

const props = defineProps<{
  activity: 'idle' | 'wave' | 'walk' | 'jump' | 'cheer' | 'point'
  duration: number
  activityRevision: number
  speaking: boolean
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const modelReady = ref(false)
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

let viewer: SkinViewer | undefined
let library: typeof import('skinview3d') | undefined
let pointer: PointerEvent | null = null
let lookYaw = 0
let lookPitch = 0

useEventListener(
  'pointermove',
  (event) => {
    if (event.pointerType === 'mouse') pointer = event
  },
  { passive: true },
)
useEventListener(
  'pointerout',
  (event) => {
    if (event.pointerType === 'mouse' && !event.relatedTarget) pointer = null
  },
  { passive: true },
)
useEventListener('blur', () => {
  pointer = null
})

onMounted(async () => {
  const element = canvas.value
  if (!element) return

  try {
    const skin = new Image()
    skin.src = '/imgs/wulian233.png'
    const [skinview3d] = await Promise.all([import('skinview3d'), skin.decode()])
    if (canvas.value !== element) return

    library = skinview3d
    viewer = new skinview3d.SkinViewer({
      canvas: element,
      width: element.clientWidth,
      height: element.clientHeight,
      pixelRatio: Math.min(window.devicePixelRatio, 2),
      enableControls: false,
      renderPaused: true,
      zoom: 0.84,
    })
    viewer.loadSkin(skin, { model: 'default' })
    viewer.playerWrapper.rotation.y = props.speaking ? 0 : REST_BODY_YAW
    viewer.playerWrapper.position.y = -1.5
    playActivity()
    modelReady.value = true
  } catch {
    disposeViewer()
  }
})

watch([() => props.activity, () => props.activityRevision, reducedMotion], playActivity)
onBeforeUnmount(disposeViewer)

function playActivity() {
  if (!viewer || !library || viewer.renderer.getContext().isContextLost()) return

  const { IdleAnimation, WalkingAnimation, WaveAnimation, FunctionAnimation } = library
  if (reducedMotion.value) {
    lookYaw = 0
    lookPitch = 0
    viewer.animation = null
    viewer.playerWrapper.rotation.y = 0
    viewer.renderPaused = true
    viewer.render()
    return
  }

  const { activity, duration } = props
  let animation: PlayerAnimation
  switch (activity) {
    case 'idle':
      animation = new IdleAnimation()
      break
    case 'wave':
      animation = new WaveAnimation()
      break
    case 'walk':
      animation = new WalkingAnimation()
      break
    case 'jump':
    case 'cheer':
    case 'point':
      animation = new FunctionAnimation((player, seconds) => {
        const progress = Math.min((seconds * 1000) / duration, 1)
        const lift = Math.sin(Math.PI * progress)
        if (activity === 'jump') {
          player.position.y = 3 * lift
        } else if (activity === 'cheer') {
          player.skin.leftArm.rotation.z = 2.3 * lift
          player.skin.rightArm.rotation.z = -2.3 * lift
          player.position.y = lift
        } else {
          player.skin.rightArm.rotation.z = -1.35 * lift
        }
      })
      break
  }

  const { camera, canvas: element, playerWrapper } = viewer
  const headCenter = camera.position.clone()
  // The animation can run before the renderer initializes the camera matrices.
  camera.updateMatrixWorld()
  viewer.animation = new FunctionAnimation((player, _seconds, delta) => {
    animation.update(player, delta)

    const blend = 1 - Math.exp(-12 * delta)
    const bodyYaw = props.speaking ? 0 : REST_BODY_YAW
    playerWrapper.rotation.y += (bodyYaw - playerWrapper.rotation.y) * blend

    const { head } = player.skin
    let targetYaw = 0
    let targetPitch = 0
    if (pointer && !props.speaking) {
      head.getWorldPosition(headCenter)
      headCenter.y += 4 // The eight-pixel head pivots at its base.
      headCenter.project(camera)

      const bounds = element.getBoundingClientRect()
      if (bounds.height > 0 && Number.isFinite(headCenter.x) && Number.isFinite(headCenter.y)) {
        const headX = bounds.left + ((headCenter.x + 1) * bounds.width) / 2
        const headY = bounds.top + ((1 - headCenter.y) * bounds.height) / 2
        const offsetX = pointer.clientX - headX
        const offsetY = pointer.clientY - headY
        const headRadius = bounds.height / 8
        const distance = Math.max(headRadius, Math.hypot(offsetX, offsetY))
        targetYaw = (offsetX / distance) * MAX_LOOK_ANGLE
        targetPitch = (offsetY / distance) * MAX_LOOK_ANGLE
      }
    }

    lookYaw += (targetYaw - lookYaw) * blend
    lookPitch += (targetPitch - lookPitch) * blend
    head.rotation.y = lookYaw
    head.rotation.x = lookPitch
  })
  viewer.renderPaused = false
}

function restoreModel() {
  window.requestAnimationFrame(() => {
    if (!viewer || viewer.renderer.getContext().isContextLost()) return
    playActivity()
    modelReady.value = true
  })
}

function disposeViewer() {
  if (!viewer) return
  viewer.dispose()
  viewer.composer.dispose()
  viewer.renderer.forceContextLoss()
  viewer = undefined
}
</script>
