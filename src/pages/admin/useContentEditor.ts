import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import {
  ContentApiError,
  createContentPage,
  getContentPage,
  listContentPages,
  saveContentDraft,
  type ContentPage,
  type ContentPageSummary,
} from '@/api/contentAdmin'
import { PAGE_TYPES, pageKindFromPath, templateFor, validateContent } from './contentConfig'
import {
  emptyMetadata,
  parseMetadata,
  stringifyMetadata,
  type PageKind,
  type SaveState,
} from './types'

export function useContentEditor(report: (message: string, kind?: 'success' | 'error') => void) {
  const pages = ref<ContentPageSummary[]>([])
  const pageKind = ref<PageKind>('document')
  const saveState = ref<SaveState>('idle')
  const saveError = ref('')
  const conflictPage = ref<ContentPage | null>(null)
  const loading = ref(false)
  const draft = reactive({
    id: '',
    path: '',
    metadata: emptyMetadata(),
    body: '',
    state: '' as ContentPage['state'] | '',
    draftVersion: 0,
  })
  let baseline = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  let activeSave: Promise<boolean> | undefined
  let applying = false

  const payload = () => ({
    path: draft.path.trim().replace(/^\/+|\/+$/g, ''),
    frontmatter: stringifyMetadata(draft.metadata),
    body: draft.body,
  })
  const signature = () => JSON.stringify(payload())
  const existingPaths = computed(() =>
    pages.value.filter((page) => page.id !== draft.id).map((page) => page.path),
  )
  const issues = computed(() =>
    validateContent(draft.path, draft.metadata, draft.body, pageKind.value, existingPaths.value),
  )
  const errors = computed(() => issues.value.filter((issue) => issue.level === 'error'))
  const warnings = computed(() => issues.value.filter((issue) => issue.level === 'warning'))
  const canCreate = computed(() => {
    const blockingFields = new Set(['path', 'title'])
    return (
      Boolean(draft.path.trim() && draft.metadata.title.trim() && draft.body.trim()) &&
      !errors.value.some((issue) => blockingFields.has(issue.field))
    )
  })
  const hasPendingChanges = computed(() =>
    ['dirty', 'saving', 'error', 'conflict'].includes(saveState.value),
  )

  function apply(page: ContentPage) {
    applying = true
    draft.id = page.id
    draft.path = page.path
    draft.metadata = parseMetadata(page.draftFrontmatter)
    draft.body = page.draftBody
    draft.state = page.state
    draft.draftVersion = page.draftVersion || 0
    pageKind.value = pageKindFromPath(page.path)
    baseline = signature()
    saveState.value = 'saved'
    saveError.value = ''
    conflictPage.value = null
    queueMicrotask(() => {
      applying = false
    })
  }

  async function refresh() {
    pages.value = (await listContentPages()).pages
  }

  function setNewPage(kind: PageKind, source?: ContentPage) {
    applying = true
    const template = templateFor(kind)
    draft.id = ''
    draft.path = PAGE_TYPES.find((type) => type.value === kind)!.prefix
    draft.metadata = source
      ? parseMetadata(source.draftFrontmatter)
      : Object.assign(emptyMetadata(), template.metadata)
    draft.body = source ? source.draftBody : template.body
    draft.state = ''
    draft.draftVersion = 0
    pageKind.value = kind
    baseline = signature()
    saveState.value = 'idle'
    saveError.value = ''
    conflictPage.value = null
    queueMicrotask(() => {
      applying = false
    })
  }

  async function leaveCurrent() {
    if (!hasPendingChanges.value) return true
    if (saveState.value === 'dirty' || saveState.value === 'saving') await saveNow()
    if (!['dirty', 'error', 'conflict'].includes(saveState.value)) return true
    return window.confirm('当前修改尚未保存。放弃这些修改并继续吗？')
  }

  async function open(id: string) {
    if (id === draft.id || !(await leaveCurrent())) return false
    loading.value = true
    try {
      apply((await getContentPage(id)).page)
      return true
    } catch (error) {
      report(error instanceof Error ? error.message : '无法读取页面', 'error')
      return false
    } finally {
      loading.value = false
    }
  }

  async function createNew(kind: PageKind) {
    if (await leaveCurrent()) setNewPage(kind)
  }
  function selectPageType(kind: PageKind) {
    const oldPrefix = PAGE_TYPES.find((type) => type.value === pageKind.value)!.prefix
    const slug =
      oldPrefix && draft.path.startsWith(oldPrefix)
        ? draft.path.slice(oldPrefix.length)
        : draft.path
    pageKind.value = kind
    const prefix = PAGE_TYPES.find((type) => type.value === kind)!.prefix
    draft.path = prefix + slug.replace(/^\/+/, '')
    if (kind !== 'document') draft.metadata.sidebar = false
  }

  async function performSave() {
    if (!draft.id && !canCreate.value) return false
    const snapshot = payload()
    const snapshotSignature = JSON.stringify(snapshot)
    saveState.value = 'saving'
    saveError.value = ''
    try {
      const result = draft.id
        ? await saveContentDraft(draft.id, {
            ...snapshot,
            expectedDraftVersion: draft.draftVersion,
          })
        : await createContentPage(snapshot)
      draft.id = result.page.id
      draft.state = result.page.state
      draft.draftVersion = result.page.draftVersion || 0
      baseline = snapshotSignature
      await refresh()
      saveState.value = signature() === snapshotSignature ? 'saved' : 'dirty'
      return true
    } catch (error) {
      if (error instanceof ContentApiError && error.code === 'EDIT_CONFLICT') {
        conflictPage.value = error.page || null
        saveState.value = 'conflict'
      } else saveState.value = 'error'
      saveError.value = error instanceof Error ? error.message : '保存失败'
      return false
    }
  }

  async function saveNow() {
    if (timer) clearTimeout(timer)
    if (activeSave) await activeSave
    if (signature() === baseline) {
      saveState.value = 'saved'
      return true
    }
    activeSave = performSave()
    const ok = await activeSave
    activeSave = undefined
    if (ok && signature() !== baseline) return saveNow()
    return ok
  }

  function useServerVersion() {
    if (conflictPage.value) apply(conflictPage.value)
  }
  async function overwriteServerVersion() {
    if (!conflictPage.value) return
    draft.draftVersion = conflictPage.value.draftVersion
    conflictPage.value = null
    saveState.value = 'dirty'
    await saveNow()
  }

  watch(
    () => [draft.path, draft.body, draft.metadata, pageKind.value],
    () => {
      if (applying || signature() === baseline) return
      saveState.value = 'dirty'
      saveError.value = ''
      if (timer) clearTimeout(timer)
      if (draft.id || canCreate.value) timer = setTimeout(() => void saveNow(), 1200)
    },
    { deep: true },
  )

  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (!hasPendingChanges.value) return
    event.preventDefault()
    event.returnValue = ''
  }
  if (typeof window !== 'undefined') window.addEventListener('beforeunload', beforeUnload)
  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
    if (typeof window !== 'undefined') window.removeEventListener('beforeunload', beforeUnload)
  })

  return {
    pages,
    draft,
    pageKind,
    saveState,
    saveError,
    conflictPage,
    loading,
    issues,
    errors,
    warnings,
    hasPendingChanges,
    refresh,
    open,
    createNew,
    selectPageType,
    saveNow,
    apply,
    leaveCurrent,
    useServerVersion,
    overwriteServerVersion,
  }
}
