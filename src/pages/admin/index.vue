<template>
  <main
    class="mx-auto min-h-[70vh] w-[min(1500px,calc(100%-2rem))] pb-18 pt-26 text-[var(--text-1)] max-sm:w-[calc(100%-1.25rem)] max-sm:pt-22"
  >
    <section
      v-if="!loggedIn"
      class="mx-auto mt-[10vh] w-[min(26rem,100%)] rounded-2xl border border-[var(--switcher-border)] bg-[var(--bg-alt)] p-7 shadow-[var(--switcher-shadow)]"
    >
      <p class="mb-2 text-xs font-800 tracking-[0.14em] text-[var(--info-1)]">CONTENT CMS</p>
      <h1 class="m-0 text-2xl">{{ needsSetup ? '设置后台密码' : '后台登录' }}</h1>
      <p class="text-sm text-[var(--text-2)]">使用 6 位数字密码直接管理网站内容。</p>
      <p
        v-if="notice"
        class="my-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
      >
        {{ notice }}
      </p>
      <form class="mt-6 grid gap-3" @submit.prevent="authenticate">
        <input
          v-model="password"
          inputmode="numeric"
          maxlength="6"
          pattern="[0-9]{6}"
          type="password"
          placeholder="6 位数字密码"
          class="cms-field"
          required
        />
        <button class="cms-primary-button" :disabled="busy">
          {{ needsSetup ? '设置并进入后台' : '登录' }}
        </button>
      </form>
    </section>
    <template v-else>
      <header
        class="mb-5 flex items-end justify-between gap-4 max-sm:items-stretch max-sm:flex-col"
      >
        <div>
          <p class="mb-2 text-xs font-800 tracking-[0.14em] text-[var(--info-1)]">CONTENT CMS</p>
          <h1 class="m-0 text-3xl max-sm:text-2xl">页面内容管理</h1>
          <p class="mb-0 mt-2 text-sm text-[var(--text-2)]">
            编辑元数据、正文并实时检查最终页面效果。
          </p>
        </div>
        <div class="flex gap-2">
          <button class="cms-button" @click="newPage">＋ 新建页面</button>
          <button class="cms-button" @click="logout">退出</button>
        </div>
      </header>
      <p
        v-if="notice"
        class="my-4 rounded-xl px-4 py-3 text-sm"
        :class="
          noticeKind === 'success'
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'bg-red-500/10 text-red-600 dark:text-red-400'
        "
      >
        {{ notice }}
      </p>
      <details
        class="group mb-5 rounded-xl border border-[var(--switcher-border)] bg-[var(--bg-soft)] p-4"
      >
        <summary class="cursor-pointer font-700 text-[var(--text-1)]">部署设置</summary>
        <p class="text-sm text-[var(--text-2)]">
          粘贴 Cloudflare Pages 的 Production Deploy Hook URL。发布时只触发一次完整构建。
        </p>
        <div class="flex gap-2 max-sm:flex-col">
          <input
            v-model="deployHook"
            class="cms-field flex-1"
            type="url"
            placeholder="https://api.cloudflare.com/..."
          />
          <button class="cms-button" @click="saveSettings">保存</button>
        </div>
      </details>
      <div
        class="grid grid-cols-[17rem_minmax(0,1fr)] items-start overflow-visible rounded-2xl border border-[var(--switcher-border)] bg-[var(--bg-alt)] shadow-[var(--vp-shadow-1)] max-lg:grid-cols-1"
      >
        <aside
          class="sticky top-22 max-h-[calc(100vh-6.5rem)] overflow-y-auto rounded-l-2xl border-r border-[var(--switcher-border)] bg-[var(--bg-soft)] p-2.5 max-lg:relative max-lg:top-auto max-lg:max-h-60 max-lg:rounded-t-2xl max-lg:rounded-bl-none max-lg:border-b max-lg:border-r-0"
        >
          <button
            class="cms-page-row"
            :class="{ 'bg-[var(--info-soft)] text-[var(--info-1)]': !draft.id }"
            @click="newPage"
          >
            ＋ 新页面
          </button>
          <button
            v-for="page in pages"
            :key="page.id"
            class="cms-page-row"
            :class="{ 'bg-[var(--info-soft)] text-[var(--info-1)]': page.id === draft.id }"
            @click="openPage(page.id)"
          >
            <span>{{ page.path }}</span>
            <small class="shrink-0" :class="stateClass(page.state)">{{ label(page.state) }}</small>
          </button>
        </aside>
        <section class="grid min-w-0 gap-5 p-6 max-sm:p-3">
          <div class="flex items-center justify-between gap-3 max-sm:items-start max-sm:flex-col">
            <div>
              <h2 class="m-0 text-xl">{{ draft.id ? '编辑页面' : '新建页面' }}</h2>
              <p class="mb-0 mt-1 text-xs text-[var(--text-muted)]">
                {{ draft.id ? draft.path : '填写路径并开始创建内容' }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="cms-button" :disabled="busy || !canSave" @click="save">
                保存草稿
              </button>
              <button
                class="cms-primary-button bg-gradient-to-br from-emerald-700 to-emerald-500"
                :disabled="busy || !canSave"
                @click="publish"
              >
                发布并完整构建
              </button>
              <button
                v-if="draft.id && draft.state !== 'archived'"
                class="cms-danger-button"
                :disabled="busy"
                @click="archive"
              >
                下线
              </button>
            </div>
          </div>
          <label class="cms-label">
            页面路径
            <input
              v-model="draft.path"
              class="cms-field font-mono"
              placeholder="例如 map/evergrowth"
            />
          </label>
          <MetadataForm v-model="draft.metadata" />
          <div
            class="grid grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)] gap-5 xl:grid-cols-2 max-xl:grid-cols-1"
          >
            <div class="grid content-start gap-2 self-start">
              <h3 class="m-0 text-lg">Markdown 正文</h3>
              <MarkdownEditor v-model="draft.body" />
            </div>
            <MarkdownPreview :body="draft.body" :metadata="draft.metadata" />
          </div>
        </section>
      </div>
    </template>
  </main>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  archiveContentPage,
  createContentPage,
  getContentAuthStatus,
  getContentPage,
  getContentSettings,
  listContentPages,
  loginContentAdmin,
  logoutContentAdmin,
  publishContentPage,
  saveContentDraft,
  saveContentSettings,
  setupContentAdmin,
  type ContentPage,
  type ContentPageSummary,
} from '@/api/contentAdmin'
import MarkdownEditor from './MarkdownEditor.vue'
import MarkdownPreview from './MarkdownPreview.vue'
import MetadataForm from './MetadataForm.vue'
import { emptyMetadata, parseMetadata, stringifyMetadata } from './types'
const loggedIn = ref(false),
  needsSetup = ref(false),
  password = ref(''),
  busy = ref(false),
  notice = ref(''),
  noticeKind = ref<'success' | 'error'>('success'),
  pages = ref<ContentPageSummary[]>([]),
  deployHook = ref('')
const draft = reactive({
  id: '',
  path: '',
  metadata: emptyMetadata(),
  body: '',
  state: '' as ContentPage['state'] | '',
})
const canSave = computed(() => Boolean(draft.path.trim() && draft.body.trim()))
const show = (message: string, kind: 'success' | 'error' = 'success') => {
  notice.value = message
  noticeKind.value = kind
}
const label = (state: string) =>
  (({ draft: '草稿', published: '已发布', archived: '已下线' }) as Record<string, string>)[state] ||
  state
const stateClass = (state: string) =>
  ({
    draft: 'text-amber-700 dark:text-amber-300',
    published: 'text-emerald-700 dark:text-emerald-300',
    archived: 'text-[var(--text-muted)]',
  })[state] || 'text-[var(--text-muted)]'
function apply(page: ContentPage) {
  draft.id = page.id
  draft.path = page.path
  draft.metadata = parseMetadata(page.draftFrontmatter)
  draft.body = page.draftBody
  draft.state = page.state
}
function newPage() {
  draft.id = ''
  draft.path = ''
  draft.metadata = emptyMetadata()
  draft.body = ''
  draft.state = ''
}
async function refresh() {
  pages.value = (await listContentPages()).pages
}
async function openPage(id: string) {
  busy.value = true
  try {
    apply((await getContentPage(id)).page)
  } catch (error) {
    show(error instanceof Error ? error.message : '无法读取页面', 'error')
  } finally {
    busy.value = false
  }
}
async function authenticate() {
  busy.value = true
  notice.value = ''
  try {
    if (needsSetup.value) await setupContentAdmin(password.value)
    else await loginContentAdmin(password.value)
    password.value = ''
    loggedIn.value = true
    await Promise.all([refresh(), loadSettings()])
  } catch (error) {
    show(error instanceof Error ? error.message : '登录失败', 'error')
  } finally {
    busy.value = false
  }
}
async function loadSettings() {
  deployHook.value = (await getContentSettings()).deploymentHookUrl
}
async function saveSettings() {
  busy.value = true
  try {
    await saveContentSettings(deployHook.value)
    show('Deploy Hook 已保存。')
  } catch (error) {
    show(error instanceof Error ? error.message : '保存失败', 'error')
  } finally {
    busy.value = false
  }
}
async function save() {
  busy.value = true
  try {
    const input = {
      path: draft.path,
      frontmatter: stringifyMetadata(draft.metadata),
      body: draft.body,
    }
    apply(
      (draft.id ? await saveContentDraft(draft.id, input) : await createContentPage(input)).page,
    )
    await refresh()
    show('草稿已保存，网站尚未更新。')
  } catch (error) {
    show(error instanceof Error ? error.message : '保存失败', 'error')
  } finally {
    busy.value = false
  }
}
async function publish() {
  await save()
  if (!draft.id || noticeKind.value === 'error') return
  busy.value = true
  try {
    const result = await publishContentPage(draft.id)
    apply(result.page)
    await refresh()
    show(
      result.deployment.requested
        ? '已发布，Cloudflare 正在完整构建。'
        : '内容已发布，但构建未触发：' + (result.deployment.error || '未知错误'),
      result.deployment.requested ? 'success' : 'error',
    )
  } catch (error) {
    show(error instanceof Error ? error.message : '发布失败', 'error')
  } finally {
    busy.value = false
  }
}
async function archive() {
  if (!draft.id || !window.confirm('确定下线这个页面吗？')) return
  busy.value = true
  try {
    const result = await archiveContentPage(draft.id)
    apply(result.page)
    await refresh()
    show(
      result.deployment.requested
        ? '已下线，Cloudflare 正在完整构建。'
        : '页面已下线，但构建未触发。',
      result.deployment.requested ? 'success' : 'error',
    )
  } catch (error) {
    show(error instanceof Error ? error.message : '下线失败', 'error')
  } finally {
    busy.value = false
  }
}
async function logout() {
  await logoutContentAdmin().catch(() => {})
  loggedIn.value = false
  password.value = ''
  newPage()
}
onMounted(async () => {
  try {
    const status = await getContentAuthStatus()
    needsSetup.value = status.needsSetup
    if (!status.needsSetup) {
      try {
        await Promise.all([refresh(), loadSettings()])
        loggedIn.value = true
      } catch {}
    }
  } catch (error) {
    show(error instanceof Error ? error.message : '无法连接内容服务', 'error')
  }
})
</script>
