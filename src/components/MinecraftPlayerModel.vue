<template>
  <span
    class="minecraft-player-model [--skin-pixel:3.35px] block w-[6rem] h-[8.8rem] pointer-events-none [filter:drop-shadow(1px_1.5px_0_rgb(15_23_42_/_0.18))_drop-shadow(0_0_1px_rgb(15_23_42_/_0.14))] max-[640px]:[--skin-pixel:2.95px] max-[640px]:w-[5.5rem] max-[640px]:h-[8rem]"
    :class="{
      'is-idle': props.activity === 'idle',
      'is-wave [.minecraft-player-model&_.minecraft-player-model\_\_part--left-arm]:[--limb-start:rotateZ(8deg)] [.minecraft-player-model&_.minecraft-player-model\_\_part--left-arm]:[--limb-end:rotateZ(140deg)] [.minecraft-player-model&_.minecraft-player-model\_\_part--left-arm]:[animation:minecraft-player-limb_1.35s_ease-in-out_1_both]':
        props.activity === 'wave',
      'is-walk [.minecraft-player-model&_.minecraft-player-model\_\_part--right-arm]:[--limb-start:rotateX(26deg)_rotateZ(18deg)] [.minecraft-player-model&_.minecraft-player-model\_\_part--right-arm]:[--limb-end:rotateX(-26deg)_rotateZ(-18deg)] [.minecraft-player-model&_.minecraft-player-model\_\_part--right-arm]:[animation:minecraft-player-limb_0.65s_linear_4_both] [.minecraft-player-model&_.minecraft-player-model\_\_part--left-leg]:[--limb-start:rotateX(26deg)_rotateZ(18deg)] [.minecraft-player-model&_.minecraft-player-model\_\_part--left-leg]:[--limb-end:rotateX(-26deg)_rotateZ(-18deg)] [.minecraft-player-model&_.minecraft-player-model\_\_part--left-leg]:[animation:minecraft-player-limb_0.65s_linear_4_both] [.minecraft-player-model&_.minecraft-player-model\_\_part--left-arm]:[--limb-start:rotateX(-26deg)_rotateZ(-18deg)] [.minecraft-player-model&_.minecraft-player-model\_\_part--left-arm]:[--limb-end:rotateX(26deg)_rotateZ(18deg)] [.minecraft-player-model&_.minecraft-player-model\_\_part--left-arm]:[animation:minecraft-player-limb_0.65s_linear_4_both] [.minecraft-player-model&_.minecraft-player-model\_\_part--right-leg]:[--limb-start:rotateX(-26deg)_rotateZ(-18deg)] [.minecraft-player-model&_.minecraft-player-model\_\_part--right-leg]:[--limb-end:rotateX(26deg)_rotateZ(18deg)] [.minecraft-player-model&_.minecraft-player-model\_\_part--right-leg]:[animation:minecraft-player-limb_0.65s_linear_4_both]':
        props.activity === 'walk',
      'is-jump': props.activity === 'jump',
      'is-cheer [.minecraft-player-model&_.minecraft-player-model\_\_part--right-arm]:[--limb-start:rotateZ(-8deg)] [.minecraft-player-model&_.minecraft-player-model\_\_part--right-arm]:[--limb-end:rotateZ(-132deg)] [.minecraft-player-model&_.minecraft-player-model\_\_part--right-arm]:[animation:minecraft-player-limb_1.2s_ease-in-out_1_both] [.minecraft-player-model&_.minecraft-player-model\_\_part--left-arm]:[--limb-start:rotateZ(8deg)] [.minecraft-player-model&_.minecraft-player-model\_\_part--left-arm]:[--limb-end:rotateZ(132deg)] [.minecraft-player-model&_.minecraft-player-model\_\_part--left-arm]:[animation:minecraft-player-limb_1.2s_ease-in-out_1_both]':
        props.activity === 'cheer',
      'is-point [.minecraft-player-model&_.minecraft-player-model\_\_part--right-arm]:[--limb-start:rotateZ(-8deg)] [.minecraft-player-model&_.minecraft-player-model\_\_part--right-arm]:[--limb-end:rotateZ(-78deg)] [.minecraft-player-model&_.minecraft-player-model\_\_part--right-arm]:[animation:minecraft-player-limb_1.5s_ease-in-out_1_both]':
        props.activity === 'point',
    }"
    aria-hidden="true"
  >
    <span
      class="minecraft-player-model__stage relative block w-full h-full [perspective:360px] [transform-style:preserve-3d] [&::before]:absolute [&::before]:[inset:0.7rem_0.25rem_0.45rem] [&::before]:[content:''] [&::before]:[background:radial-gradient(ellipse,_rgb(15_23_42_/_0.23),_transparent_68%)] [&::before]:[filter:blur(3px)] [&::before]:opacity-[0.62] [&::before]:[transform:translateY(1.2rem)_rotateX(70deg)] [.minecraft-player-model.is-idle_&]:[--bob-y:-1px] [.minecraft-player-model.is-idle_&]:[--bob-yaw:-12deg] [.minecraft-player-model.is-idle_&]:[animation:minecraft-player-bob_1.2s_ease-in-out_1_both] [.minecraft-player-model.is-idle_&]:[animation-iteration-count:infinite] [.minecraft-player-model.is-idle_&]:[animation-duration:3.6s] [.minecraft-player-model.is-walk_&]:[--bob-y:-2px] [.minecraft-player-model.is-walk_&]:[--bob-yaw:-14deg] [.minecraft-player-model.is-walk_&]:[animation:minecraft-player-bob_1.2s_ease-in-out_1_both] [.minecraft-player-model.is-walk_&]:[animation-duration:2.6s] [.minecraft-player-model.is-jump_&]:[--bob-y:-7px] [.minecraft-player-model.is-jump_&]:[--bob-yaw:8deg] [.minecraft-player-model.is-jump_&]:[animation:minecraft-player-bob_1.2s_ease-in-out_1_both] [.minecraft-player-model.is-cheer_&]:[--bob-y:-3px] [.minecraft-player-model.is-cheer_&]:[--bob-yaw:5deg] [.minecraft-player-model.is-cheer_&]:[animation:minecraft-player-bob_1.2s_ease-in-out_1_both] motion-reduce:[animation:none]!"
    >
      <span
        v-for="part in playerParts"
        :key="`${part.key}-${part.layer ? 'outer' : 'base'}`"
        class="minecraft-player-model__part absolute [top:0] [left:50%] block w-[calc(var(--part-width)_*_var(--skin-pixel))] h-[calc(var(--part-height)_*_var(--skin-pixel))] mt-[calc(var(--part-height)_*_var(--skin-pixel)_*_-0.5)] ml-[calc(var(--part-width)_*_var(--skin-pixel)_*_-0.5)] [--part-transform:translate3d(_calc(var(--part-x)_*_var(--skin-pixel)),_calc((var(--part-y)_+_var(--part-height)_/_2)_*_var(--skin-pixel)),_calc(var(--part-z)_*_var(--skin-pixel))_)] [transform:var(--part-transform)] [transform-origin:center_top] [transform-style:preserve-3d] motion-reduce:[animation:none]!"
        :class="[
          `minecraft-player-model__part--${part.key}`,
          { 'is-outer-layer [.minecraft-player-model\_\_&:is(part)]:z-[2]': part.layer },
        ]"
        :style="partStyle(part)"
      >
        <span
          v-for="face in part.faces"
          :key="face.name"
          class="minecraft-player-model__face absolute block w-[calc(var(--face-width)_*_var(--skin-pixel))] h-[calc(var(--face-height)_*_var(--skin-pixel))] [background-image:url('/imgs/wulian233.png')] [background-repeat:no-repeat] [background-size:calc(64_*_var(--skin-pixel))_calc(64_*_var(--skin-pixel))] [background-position:calc(var(--uv-x)_*_var(--skin-pixel)_*_-1)_calc(var(--uv-y)_*_var(--skin-pixel)_*_-1)] [image-rendering:pixelated] [backface-visibility:hidden]"
          :class="`minecraft-player-model__face--${face.name}`"
          :style="faceStyle(part, face)"
        ></span>
      </span>
    </span>
  </span>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue'

type FaceName = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom'

interface SkinFace {
  name: FaceName
  uvX: number
  uvY: number
}

interface SkinPart {
  key: 'head' | 'body' | 'right-arm' | 'left-arm' | 'right-leg' | 'left-leg'
  width: number
  height: number
  depth: number
  x: number
  y: number
  z: number
  layer?: boolean
  faces: SkinFace[]
}

const props = withDefaults(
  defineProps<{
    activity?: 'idle' | 'wave' | 'walk' | 'jump' | 'cheer' | 'point'
  }>(),
  { activity: 'idle' },
)

const face = (name: FaceName, uvX: number, uvY: number): SkinFace => ({ name, uvX, uvY })

const boxFaces = (coordinates: Record<FaceName, [number, number]>) =>
  (Object.entries(coordinates) as [FaceName, [number, number]][]).map(([name, [uvX, uvY]]) =>
    face(name, uvX, uvY),
  )

const createPart = (
  part: Omit<SkinPart, 'faces'> & { coordinates: Record<FaceName, [number, number]> },
): SkinPart => ({
  ...part,
  faces: boxFaces(part.coordinates),
})

const baseParts: SkinPart[] = [
  createPart({
    key: 'head',
    width: 8,
    height: 8,
    depth: 8,
    x: 0,
    y: 0,
    z: 0,
    coordinates: {
      top: [8, 0],
      bottom: [16, 0],
      right: [0, 8],
      front: [8, 8],
      left: [16, 8],
      back: [24, 8],
    },
  }),
  createPart({
    key: 'body',
    width: 8,
    height: 12,
    depth: 4,
    x: 0,
    y: 8,
    z: 0,
    coordinates: {
      top: [20, 16],
      bottom: [28, 16],
      right: [16, 20],
      front: [20, 20],
      left: [28, 20],
      back: [32, 20],
    },
  }),
  createPart({
    key: 'right-arm',
    width: 4,
    height: 12,
    depth: 4,
    x: 6,
    y: 8,
    z: 0,
    coordinates: {
      top: [44, 16],
      bottom: [48, 16],
      right: [40, 20],
      front: [44, 20],
      left: [48, 20],
      back: [52, 20],
    },
  }),
  createPart({
    key: 'left-arm',
    width: 4,
    height: 12,
    depth: 4,
    x: -6,
    y: 8,
    z: 0,
    coordinates: {
      top: [36, 48],
      bottom: [40, 48],
      right: [32, 52],
      front: [36, 52],
      left: [40, 52],
      back: [44, 52],
    },
  }),
  createPart({
    key: 'right-leg',
    width: 4,
    height: 12,
    depth: 4,
    x: 2,
    y: 20,
    z: 0,
    coordinates: {
      top: [4, 16],
      bottom: [8, 16],
      right: [0, 20],
      front: [4, 20],
      left: [8, 20],
      back: [12, 20],
    },
  }),
  createPart({
    key: 'left-leg',
    width: 4,
    height: 12,
    depth: 4,
    x: -2,
    y: 20,
    z: 0,
    coordinates: {
      top: [20, 48],
      bottom: [24, 48],
      right: [16, 52],
      front: [20, 52],
      left: [24, 52],
      back: [28, 52],
    },
  }),
]

const outerParts: SkinPart[] = [
  createPart({
    key: 'head',
    width: 8.5,
    height: 8.5,
    depth: 8.5,
    x: 0,
    y: -0.25,
    z: 0,
    layer: true,
    coordinates: {
      top: [40, 0],
      bottom: [48, 0],
      right: [32, 8],
      front: [40, 8],
      left: [48, 8],
      back: [56, 8],
    },
  }),
  createPart({
    key: 'body',
    width: 8.5,
    height: 12.5,
    depth: 4.5,
    x: 0,
    y: 7.75,
    z: 0,
    layer: true,
    coordinates: {
      top: [20, 32],
      bottom: [28, 32],
      right: [16, 36],
      front: [20, 36],
      left: [28, 36],
      back: [32, 36],
    },
  }),
  createPart({
    key: 'right-arm',
    width: 4.5,
    height: 12.5,
    depth: 4.5,
    x: 6,
    y: 7.75,
    z: 0,
    layer: true,
    coordinates: {
      top: [44, 32],
      bottom: [48, 32],
      right: [40, 36],
      front: [44, 36],
      left: [48, 36],
      back: [52, 36],
    },
  }),
  createPart({
    key: 'left-arm',
    width: 4.5,
    height: 12.5,
    depth: 4.5,
    x: -6,
    y: 7.75,
    z: 0,
    layer: true,
    coordinates: {
      top: [52, 48],
      bottom: [56, 48],
      right: [48, 52],
      front: [52, 52],
      left: [56, 52],
      back: [60, 52],
    },
  }),
  createPart({
    key: 'right-leg',
    width: 4.5,
    height: 12.5,
    depth: 4.5,
    x: 2,
    y: 19.75,
    z: 0,
    layer: true,
    coordinates: {
      top: [4, 32],
      bottom: [8, 32],
      right: [0, 36],
      front: [4, 36],
      left: [8, 36],
      back: [12, 36],
    },
  }),
  createPart({
    key: 'left-leg',
    width: 4.5,
    height: 12.5,
    depth: 4.5,
    x: -2,
    y: 19.75,
    z: 0,
    layer: true,
    coordinates: {
      top: [4, 48],
      bottom: [8, 48],
      right: [0, 52],
      front: [4, 52],
      left: [8, 52],
      back: [12, 52],
    },
  }),
]

const playerParts = [...baseParts, ...outerParts]

function partStyle(part: SkinPart): CSSProperties {
  return {
    '--part-width': `${part.width}`,
    '--part-height': `${part.height}`,
    '--part-depth': `${part.depth}`,
    '--part-x': `${part.x}`,
    '--part-y': `${part.y}`,
    '--part-z': `${part.z}`,
  } as CSSProperties
}

function faceStyle(part: SkinPart, skinFace: SkinFace): CSSProperties {
  const width = ['top', 'bottom', 'front', 'back'].includes(skinFace.name) ? part.width : part.depth
  const height = ['top', 'bottom'].includes(skinFace.name) ? part.depth : part.height

  return {
    '--face-width': `${width}`,
    '--face-height': `${height}`,
    '--uv-x': `${skinFace.uvX}`,
    '--uv-y': `${skinFace.uvY}`,
  } as CSSProperties
}
</script>
