import { computed, onScopeDispose, ref, shallowReactive } from 'vue'
import type { Ref } from 'vue'
import { usePageScrollLock } from './usePageScrollLock'

interface DialogLayer {
  zIndex: Ref<number>
}

const layers = shallowReactive<DialogLayer[]>([])
let background: HTMLElement | null = null
let backgroundWasInert = false

export function useDialogLayer() {
  const layer: DialogLayer = { zIndex: ref(2100) }
  const { lock, unlock } = usePageScrollLock()
  const isTop = computed(() => layers.at(-1) === layer)

  function activate() {
    if (typeof document === 'undefined' || layers.includes(layer)) return false
    if (!layers.length) {
      background = document.getElementById('app')
      backgroundWasInert = background?.inert ?? false
      if (background) background.inert = true
    }
    layer.zIndex.value = 2100 + layers.length * 10
    layers.push(layer)
    lock()
    return true
  }

  function deactivate() {
    const index = layers.indexOf(layer)
    if (index < 0) return
    layers.splice(index, 1)
    for (let i = index; i < layers.length; i++) layers[i].zIndex.value = 2100 + i * 10
    unlock()
    if (!layers.length) {
      if (background) background.inert = backgroundWasInert
      background = null
    }
  }

  onScopeDispose(deactivate)
  return { isTop, zIndex: layer.zIndex, activate, deactivate }
}
