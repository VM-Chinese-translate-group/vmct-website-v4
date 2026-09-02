<template>
  <main
    class="mx-auto min-h-[70vh] w-[min(1600px,calc(100%-2rem))] pb-14 pt-3 text-[var(--text-1)] max-sm:w-[calc(100%-1.25rem)]"
  >
    <Transition name="cms-toast">
      <p
        v-if="notice"
        class="fixed left-1/2 top-20 z-80 m-0 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-xl px-4 py-3 text-sm shadow-lg"
        :class="noticeKind === 'success' ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'"
      >
        {{ notice }}
      </p>
    </Transition>

    <AdminLogin v-if="!loggedIn" :needs-setup="needsSetup" :busy="busy" @submit="authenticate" />

    <template v-else>
      <header
        class="mb-4 flex items-center justify-between gap-4 max-sm:items-stretch max-sm:flex-col"
      >
        <div>
          <p class="mb-1 text-xs font-800 tracking-[0.14em] text-[var(--info-1)]">CONTENT CMS</p>
          <h1 class="m-0 text-3xl leading-tight max-sm:text-2xl">
            {{ isSettingsPage ? '后台设置' : '内容工作台' }}
          </h1>
          <p class="mb-0 mt-1 text-sm text-[var(--text-2)]">
            {{
              isSettingsPage
                ? '管理部署与登录安全。'
                : '草稿自动保存，可在左侧选择多个更改后统一发布。'
            }}
          </p>
        </div>
        <div
          class="flex flex-wrap gap-1.5 rounded-xl border border-[var(--switcher-border)] bg-[var(--bg-alt)] p-1.5 shadow-sm"
        >
          <button class="cms-button" type="button" @click="openSection">
            {{ isSettingsPage ? '返回工作台' : '后台设置' }}
          </button>
          <button class="cms-button" type="button" @click="logout">退出</button>
        </div>
      </header>

      <AdminSettings
        v-if="isSettingsPage"
        :deployment-hook="deployHook"
        :managed-by-environment="passwordManagedByEnvironment"
        :busy="busy"
        @save-hook="saveSettings"
        @change-password="changePassword"
        @retry-deploy="retryDeploy"
      />

      <div v-else class="grid grid-cols-[17rem_minmax(0,1fr)] items-start gap-4 max-lg:grid-cols-1">
        <ContentLibrary
          :pages="libraryPages"
          :selected-id="editor.draft.id"
          v-model:selected-changes="selectedChanges"
          :busy="busy"
          @open="editor.open"
          @new="editor.createNew"
          @publish-selected="prepareBatchPublish"
          @discard="discardDraft"
        />

        <section
          class="min-w-0 rounded-2xl border border-[var(--switcher-border)] bg-[var(--bg-soft)] shadow-[var(--vp-shadow-1)]"
        >
          <header
            class="sticky top-18 z-20 flex items-center justify-between gap-3 rounded-t-2xl border-b border-[var(--switcher-border)] bg-[color-mix(in_srgb,var(--bg-alt)_94%,transparent)] px-5 py-3 backdrop-blur max-sm:items-start max-sm:flex-col max-sm:px-3"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="m-0 truncate text-xl">
                  {{ editor.draft.metadata.title || (editor.draft.id ? '未命名页面' : '新页面') }}
                </h2>
                <span class="rounded-full px-2 py-1 text-xs font-700" :class="saveStateClass">
                  {{ saveStateLabel }}
                </span>
              </div>
              <p class="mb-0 mt-1 truncate font-mono text-xs text-[var(--text-muted)]">
                {{ editor.draft.path ? `/${editor.draft.path}` : '尚未填写路径' }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                class="cms-button"
                type="button"
                :disabled="busy || editor.saveState.value === 'saving'"
                @click="editor.saveNow"
              >
                立即保存
              </button>
              <button
                class="cms-button"
                type="button"
                :disabled="!editor.draft.id"
                @click="historyOpen = true"
              >
                历史
              </button>
              <button
                class="cms-primary-button bg-gradient-to-br from-emerald-700 to-emerald-500"
                type="button"
                :disabled="busy || !editor.draft.id || editor.saveState.value === 'conflict'"
                @click="preparePublish"
              >
                发布
              </button>
              <button
                v-if="editor.draft.id && editor.draft.state !== 'archived'"
                class="cms-danger-button"
                type="button"
                :disabled="busy"
                @click="archive"
              >
                下线
              </button>
            </div>
          </header>

          <div
            v-if="editor.saveState.value === 'conflict'"
            class="m-4 flex flex-wrap items-center gap-3 rounded-xl bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300"
          >
            <strong>检测到其他窗口保存了新版本。</strong>
            <span>请选择保留服务器版本，或用当前内容覆盖。</span>
            <button class="cms-button ml-auto" type="button" @click="editor.useServerVersion">
              使用服务器版本
            </button>
            <button class="cms-danger-button" type="button" @click="editor.overwriteServerVersion">
              覆盖服务器版本
            </button>
          </div>
          <div
            v-else-if="editor.saveState.value === 'error'"
            class="m-4 flex items-center gap-3 rounded-xl bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300"
          >
            <span>{{ editor.saveError.value }}</span>
            <button class="cms-button ml-auto" @click="editor.saveNow">重试保存</button>
          </div>

          <nav
            class="mx-3 mt-3 hidden grid-cols-3 gap-1 rounded-xl bg-[var(--bg-alt)] p-1 max-lg:grid"
          >
            <button
              v-for="tab in tabs"
              :key="tab.value"
              class="cms-button border-0"
              :class="{ 'bg-[var(--info-soft)] text-[var(--info-1)]': activeTab === tab.value }"
              @click="activeTab = tab.value"
            >
              {{ tab.label }}
            </button>
          </nav>

          <div class="grid gap-5 p-5 max-sm:p-3">
            <section :class="{ 'max-lg:hidden': activeTab !== 'metadata' }" class="grid gap-4">
              <div class="grid gap-2">
                <span class="cms-label">页面类型</span>
                <div class="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
                  <button
                    v-for="type in PAGE_TYPES"
                    :key="type.value"
                    class="cms-button justify-start"
                    :class="
                      editor.pageKind.value === type.value
                        ? 'border-[var(--info-1)] bg-[var(--info-soft)] text-[var(--info-1)]'
                        : ''
                    "
                    @click="editor.selectPageType(type.value)"
                  >
                    <Icon :icon="type.icon" />
                    <span>{{ type.label }}</span>
                    <small class="ml-auto text-[var(--text-muted)]">{{ type.hint }}</small>
                  </button>
                </div>
              </div>
              <label class="cms-label">
                {{ editor.pageKind.value === 'document' ? '页面路径' : '页面标识' }}
                <input
                  v-model="pageSlug"
                  class="cms-field font-mono"
                  :placeholder="
                    editor.pageKind.value === 'document'
                      ? '例如 guides/getting-started'
                      : '例如 evergrowth'
                  "
                />
                <small class="text-[var(--text-muted)]">
                  最终地址：/{{ editor.draft.path || '尚未填写' }}
                </small>
              </label>
              <MetadataForm v-model="editor.draft.metadata" :page-kind="editor.pageKind.value" />
            </section>

            <section
              :class="{ 'max-lg:hidden': activeTab !== 'content' }"
              class="grid content-start gap-2"
            >
              <div class="flex items-center justify-between">
                <h3 class="m-0 text-lg">Markdown 正文</h3>
                <small class="text-[var(--text-muted)]">{{ editor.draft.body.length }} 字符</small>
              </div>
              <MarkdownEditor v-model="editor.draft.body" />
            </section>

            <section :class="{ 'max-lg:hidden': activeTab !== 'preview' }">
              <MarkdownPreview
                :body="editor.draft.body"
                :metadata="editor.draft.metadata"
                :page-kind="editor.pageKind.value"
              />
            </section>

            <section
              v-if="editor.issues.value.length"
              class="rounded-xl border border-[var(--switcher-border)] bg-[var(--bg-alt)] p-4"
            >
              <h3 class="m-0 text-base">内容检查</h3>
              <ul class="mb-0 mt-2 grid gap-1 pl-5 text-sm">
                <li
                  v-for="issue in editor.issues.value"
                  :key="issue.field + issue.message"
                  :class="
                    issue.level === 'error'
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-amber-800 dark:text-amber-200'
                  "
                >
                  {{ issue.message }}
                </li>
              </ul>
            </section>
          </div>
        </section>
      </div>
    </template>

    <PublishDialog
      :open="publishOpen"
      :busy="busy"
      :errors="publishErrors"
      :warnings="publishWarnings"
      :page-count="publishMode === 'batch' ? selectedChanges.length : 1"
      :batch="publishMode === 'batch'"
      @close="publishOpen = false"
      @confirm="publish"
    />
    <RevisionPanel
      :open="historyOpen"
      :page-id="editor.draft.id"
      :current-frontmatter="currentFrontmatter"
      :current-body="editor.draft.body"
      @close="historyOpen = false"
      @restore="restoreRevision"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useRoute, useRouter } from 'vue-router'
import {
  archiveContentPage,
  changeContentAdminPassword,
  discardContentDraft,
  getContentAuthStatus,
  getContentSettings,
  loginContentAdmin,
  logoutContentAdmin,
  publishContentPage,
  publishContentPages,
  restoreContentRevision,
  retryContentDeployment,
  saveContentSettings,
  setupContentAdmin,
} from '@/api/contentAdmin'
import AdminLogin from './AdminLogin.vue'
import AdminSettings from './AdminSettings.vue'
import ContentLibrary from './ContentLibrary.vue'
import MarkdownEditor from './MarkdownEditor.vue'
import MarkdownPreview from './MarkdownPreview.vue'
import MetadataForm from './MetadataForm.vue'
import PublishDialog from './PublishDialog.vue'
import RevisionPanel from './RevisionPanel.vue'
import { PAGE_TYPES } from './contentConfig'
import { stringifyMetadata } from './types'
import { useContentEditor } from './useContentEditor'

const route = useRoute(),
  router = useRouter()
const loggedIn = ref(false),
  needsSetup = ref(false),
  passwordManagedByEnvironment = ref(false),
  busy = ref(false)
const deployHook = ref(''),
  notice = ref(''),
  noticeKind = ref<'success' | 'error'>('success')
const publishOpen = ref(false),
  publishMode = ref<'single' | 'batch'>('single'),
  selectedChanges = ref<string[]>([]),
  historyOpen = ref(false),
  activeTab = ref<'metadata' | 'content' | 'preview'>('metadata')
const tabs = [
  { value: 'metadata' as const, label: '基本信息' },
  { value: 'content' as const, label: '正文' },
  { value: 'preview' as const, label: '预览' },
]
let noticeTimer: ReturnType<typeof setTimeout> | undefined
const isSettingsPage = computed(() => route.name === 'content-admin-settings')
const show = (message: string, kind: 'success' | 'error' = 'success') => {
  notice.value = message
  noticeKind.value = kind
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = ''
  }, 6000)
}
const editor = useContentEditor(show)
const selectedType = computed(() =>
  PAGE_TYPES.find((type) => type.value === editor.pageKind.value)!,
)
const currentFrontmatter = computed(() => stringifyMetadata(editor.draft.metadata))
const libraryPages = computed(() =>
  editor.pages.value.map((page) =>
    page.id === editor.draft.id &&
    editor.draft.state === 'published' &&
    ['dirty', 'saving', 'error', 'conflict'].includes(editor.saveState.value)
      ? {
          ...page,
          draftFrontmatter: currentFrontmatter.value,
          hasUnpublishedChanges: true,
        }
      : page,
  ),
)
const publishErrors = computed(() =>
  publishMode.value === 'single' || selectedChanges.value.includes(editor.draft.id)
    ? editor.errors.value
    : [],
)
const publishWarnings = computed(() =>
  publishMode.value === 'single' || selectedChanges.value.includes(editor.draft.id)
    ? editor.warnings.value
    : [],
)
const pageSlug = computed({
  get: () =>
    selectedType.value.prefix && editor.draft.path.startsWith(selectedType.value.prefix)
      ? editor.draft.path.slice(selectedType.value.prefix.length)
      : editor.draft.path,
  set: (value: string) => {
    editor.draft.path = selectedType.value.prefix + value.replace(/^\/+/, '')
  },
})
const saveStateLabel = computed(
  () =>
    ({
      idle: '等待填写',
      dirty: '有修改',
      saving: '保存中…',
      saved: '已保存',
      error: '保存失败',
      conflict: '版本冲突',
    })[editor.saveState.value],
)
const saveStateClass = computed(
  () =>
    ({
      idle: 'bg-[var(--bg-alt)] text-[var(--text-muted)]',
      dirty: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
      saving: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
      saved: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      error: 'bg-red-500/10 text-red-700 dark:text-red-300',
      conflict: 'bg-red-500/10 text-red-700 dark:text-red-300',
    })[editor.saveState.value],
)

async function loadAdmin() {
  await Promise.all([editor.refresh(), loadSettings()])
  if (editor.pages.value.length && !editor.draft.id) await editor.open(editor.pages.value[0].id)
  else if (!editor.pages.value.length) await editor.createNew('document')
}
async function authenticate(password: string) {
  busy.value = true
  try {
    if (needsSetup.value) await setupContentAdmin(password)
    else await loginContentAdmin(password)
    needsSetup.value = false
    loggedIn.value = true
    await loadAdmin()
    show('已进入内容工作台。')
  } catch (error) {
    show(error instanceof Error ? error.message : '登录失败', 'error')
  } finally {
    busy.value = false
  }
}
async function loadSettings() {
  deployHook.value = (await getContentSettings()).deploymentHookUrl
}
async function saveSettings(value: string) {
  busy.value = true
  try {
    deployHook.value = (await saveContentSettings(value)).deploymentHookUrl
    show('部署设置已保存。')
  } catch (error) {
    show(error instanceof Error ? error.message : '保存失败', 'error')
  } finally {
    busy.value = false
  }
}
async function changePassword(value: string) {
  busy.value = true
  try {
    await changeContentAdminPassword(value)
    loggedIn.value = false
    show('密码已修改，请重新登录。')
  } catch (error) {
    show(error instanceof Error ? error.message : '修改密码失败', 'error')
  } finally {
    busy.value = false
  }
}
async function retryDeploy() {
  busy.value = true
  try {
    const result = (await retryContentDeployment()).deployment
    show(
      result.requested
        ? '已请求 Cloudflare 完整构建。'
        : `构建未触发：${result.error || '未知错误'}`,
      result.requested ? 'success' : 'error',
    )
  } catch (error) {
    show(error instanceof Error ? error.message : '构建请求失败', 'error')
  } finally {
    busy.value = false
  }
}
async function preparePublish() {
  if (!(await editor.saveNow()) || !editor.draft.id) {
    show('请先解决草稿保存问题。', 'error')
    return
  }
  publishMode.value = 'single'
  publishOpen.value = true
}
async function prepareBatchPublish() {
  if (!selectedChanges.value.length) return
  if (selectedChanges.value.includes(editor.draft.id) && !(await editor.saveNow())) {
    show('请先解决当前草稿的保存问题。', 'error')
    return
  }
  await editor.refresh()
  const available = new Set(
    editor.pages.value
      .filter((page) => Boolean(page.hasUnpublishedChanges) && page.state !== 'archived')
      .map((page) => page.id),
  )
  selectedChanges.value = selectedChanges.value.filter((id) => available.has(id))
  if (!selectedChanges.value.length) {
    show('所选文件已经没有待发布的更改。', 'error')
    return
  }
  publishMode.value = 'batch'
  publishOpen.value = true
}
async function discardDraft(id: string) {
  const selectedPage = editor.pages.value.find((item) => item.id === id)
  if (!selectedPage) return
  const name = selectedPage.path ? `/${selectedPage.path}` : '这个页面'
  if (!window.confirm(`撤回 ${name} 的全部草稿修改，恢复到当前线上版本吗？此操作无法撤销。`)) return
  busy.value = true
  try {
    if (editor.draft.id === id && editor.hasPendingChanges.value) await editor.saveNow()
    await editor.refresh()
    const latest = editor.pages.value.find((item) => item.id === id)
    if (!latest) throw new Error('页面不存在')
    const result = await discardContentDraft(id, latest.draftVersion)
    if (editor.draft.id === id) editor.apply(result.page)
    selectedChanges.value = selectedChanges.value.filter((selectedId) => selectedId !== id)
    await editor.refresh()
    show('草稿已撤回，内容已恢复到线上版本。')
  } catch (error) {
    show(error instanceof Error ? error.message : '撤回草稿失败', 'error')
  } finally {
    busy.value = false
  }
}
async function publish(message: string) {
  busy.value = true
  try {
    const result =
      publishMode.value === 'batch'
        ? await publishContentPages(
            selectedChanges.value.map((id) => {
              const page = editor.pages.value.find((item) => item.id === id)!
              return { id, expectedDraftVersion: page.draftVersion }
            }),
            message,
          )
        : await publishContentPage(editor.draft.id, editor.draft.draftVersion, message)
    const publishedPages = 'pages' in result ? result.pages : [result.page]
    const current = publishedPages.find((page) => page.id === editor.draft.id)
    if (current) editor.apply(current)
    await editor.refresh()
    const publishedIds = new Set(publishedPages.map((page) => page.id))
    selectedChanges.value = selectedChanges.value.filter((id) => !publishedIds.has(id))
    publishOpen.value = false
    show(
      result.deployment.requested
        ? `${publishedPages.length} 个更改已发布，Cloudflare 正在构建。`
        : `${publishedPages.length} 个更改已发布，但构建未触发：${result.deployment.error || '未知错误'}`,
      result.deployment.requested ? 'success' : 'error',
    )
  } catch (error) {
    show(error instanceof Error ? error.message : '发布失败', 'error')
  } finally {
    busy.value = false
  }
}
async function archive() {
  if (!window.confirm('确定下线这个页面吗？网站构建后将不再公开显示。')) return
  if (!(await editor.saveNow())) {
    show('请先解决草稿保存问题。', 'error')
    return
  }
  busy.value = true
  try {
    const result = await archiveContentPage(editor.draft.id, editor.draft.draftVersion)
    editor.apply(result.page)
    await editor.refresh()
    show(
      result.deployment.requested
        ? '页面已下线，Cloudflare 正在构建。'
        : `页面已下线，但构建未触发：${result.deployment.error || '未知错误'}`,
      result.deployment.requested ? 'success' : 'error',
    )
  } catch (error) {
    show(error instanceof Error ? error.message : '下线失败', 'error')
  } finally {
    busy.value = false
  }
}
async function restoreRevision(revision: number) {
  if (!window.confirm(`将版本 ${revision} 恢复为当前草稿吗？不会自动发布。`)) return
  busy.value = true
  try {
    const result = await restoreContentRevision(
      editor.draft.id,
      revision,
      editor.draft.draftVersion,
    )
    editor.apply(result.page)
    await editor.refresh()
    historyOpen.value = false
    show(`版本 ${revision} 已恢复为草稿。`)
  } catch (error) {
    show(error instanceof Error ? error.message : '恢复失败', 'error')
  } finally {
    busy.value = false
  }
}
async function openSection() {
  if (!isSettingsPage.value && !(await editor.leaveCurrent())) return
  await router.push(isSettingsPage.value ? '/admin' : '/admin/settings')
}
async function logout() {
  if (!(await editor.leaveCurrent())) return
  await logoutContentAdmin().catch(() => {})
  loggedIn.value = false
  await router.push('/admin')
}
const keydown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void editor.saveNow()
  }
}
onMounted(async () => {
  document.addEventListener('keydown', keydown)
  try {
    const status = await getContentAuthStatus()
    needsSetup.value = status.needsSetup
    passwordManagedByEnvironment.value = status.managedByEnvironment
    if (!status.needsSetup) {
      try {
        await loadAdmin()
        loggedIn.value = true
      } catch {}
    }
  } catch (error) {
    show(error instanceof Error ? error.message : '无法连接内容服务', 'error')
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', keydown)
  if (noticeTimer) clearTimeout(noticeTimer)
})
</script>

<style scoped>
.cms-toast-enter-active,
.cms-toast-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.cms-toast-enter-from,
.cms-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -0.5rem);
}
@media (min-width: 1025px) {
  .cms-library + section > div.grid {
    grid-template-columns: minmax(0, 1fr) minmax(24rem, 0.92fr);
  }
  .cms-library + section > div.grid > section:first-child {
    grid-column: 1/-1;
  }
  .cms-library + section > div.grid > section:nth-child(4) {
    grid-column: 1/-1;
  }
}
</style>
