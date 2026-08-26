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
      <p
        v-if="notice"
        class="my-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
      >
        {{ notice }}
      </p>
      <form class="mt-6 grid gap-3" @submit.prevent="authenticate">
        <input
          v-model="password"
          type="password"
          placeholder="至少 6 位，可含数字、字母或符号"
          class="cms-field"
          minlength="6"
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
          <div class="relative">
            <button
              class="cms-button"
              @click="newPageMenuLocation = newPageMenuLocation === 'header' ? '' : 'header'"
            >
              ＋ 新建页面
            </button>
            <div
              v-if="newPageMenuLocation === 'header'"
              class="absolute right-0 z-10 mt-2 grid w-52 gap-1 rounded-xl border border-[var(--switcher-border)] bg-[var(--bg-alt)] p-1.5 shadow-[var(--switcher-shadow)]"
            >
              <button
                v-for="type in pageTypes"
                :key="type.value"
                class="cms-page-row"
                type="button"
                @click="newPage(type.value)"
              >
                <span>{{ type.label }}</span>
                <small class="text-[var(--text-muted)]">{{ type.hint }}</small>
              </button>
            </div>
          </div>
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
            @click="newPageMenuLocation = newPageMenuLocation === 'aside' ? '' : 'aside'"
          >
            ＋ 新页面
          </button>
          <div v-if="newPageMenuLocation === 'aside'" class="grid gap-1 px-1 py-1">
            <button
              v-for="type in pageTypes"
              :key="type.value"
              class="cms-page-row"
              type="button"
              @click="newPage(type.value)"
            >
              <span>{{ type.label }}</span>
              <small class="text-[var(--text-muted)]">{{ type.hint }}</small>
            </button>
          </div>
          <label class="sr-only" for="page-search">搜索页面</label>
          <input
            id="page-search"
            v-model="pageSearch"
            class="cms-field my-2 w-full text-sm"
            type="search"
            placeholder="搜索页面路径"
          />
          <button
            v-for="page in filteredPages"
            :key="page.id"
            class="cms-page-row"
            :class="{ 'bg-[var(--info-soft)] text-[var(--info-1)]': page.id === draft.id }"
            @click="openPage(page.id)"
          >
            <span>{{ page.path }}</span>
            <span class="flex shrink-0 items-center gap-1.5">
              <small
                class="rounded bg-[var(--bg-alt)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]"
              >
                {{ pageType(page.path).label }}
              </small>
              <small :class="stateClass(page.state)">{{ label(page.state) }}</small>
            </span>
          </button>
          <p
            v-if="pageSearch && !filteredPages.length"
            class="px-3 py-2 text-sm text-[var(--text-muted)]"
          >
            未找到匹配页面
          </p>
        </aside>
        <section class="grid min-w-0 gap-5 p-6 max-sm:p-3">
          <div class="flex items-center justify-between gap-3 max-sm:items-start max-sm:flex-col">
            <div>
              <h2 class="m-0 text-xl">{{ draft.id ? '编辑页面' : '新建页面' }}</h2>
              <p class="mb-0 mt-1 text-xs text-[var(--text-muted)]">
                {{ draft.id ? draft.path : '选择类型后填写页面标识' }}
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
          <div class="grid gap-2">
            <span class="cms-label">页面类型</span>
            <div class="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
              <button
                v-for="type in pageTypes"
                :key="type.value"
                class="cms-button justify-start text-left"
                :class="
                  pageKind === type.value
                    ? 'border-[var(--info-1)] bg-[var(--info-soft)] text-[var(--info-1)]'
                    : ''
                "
                type="button"
                @click="selectPageType(type.value)"
              >
                <span>{{ type.label }}</span>
                <small class="ml-auto text-[var(--text-muted)]">{{ type.hint }}</small>
              </button>
            </div>
          </div>
          <label class="cms-label">
            {{ pageKind === 'document' ? '页面路径' : '页面标识' }}
            <input v-model="pageSlug" class="cms-field font-mono" :placeholder="pathPlaceholder" />
            <small v-if="pagePrefix" class="text-[var(--text-muted)]">
              将创建为 /{{ pagePrefix }}{{ pageSlug || '页面标识' }}
            </small>
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
type PageKind = 'document' | 'modpack' | 'map'

const pageTypes: { value: PageKind; label: string; hint: string; prefix: string }[] = [
  { value: 'document', label: '文档', hint: '普通页面', prefix: '' },
  { value: 'modpack', label: '整合包', hint: '/modpacks/', prefix: 'modpacks/' },
  { value: 'map', label: '地图', hint: '/map/', prefix: 'map/' },
]
const loggedIn = ref(false),
  needsSetup = ref(false),
  password = ref(''),
  busy = ref(false),
  notice = ref(''),
  noticeKind = ref<'success' | 'error'>('success'),
  pages = ref<ContentPageSummary[]>([]),
  pageSearch = ref(''),
  deployHook = ref(''),
  newPageMenuLocation = ref<'header' | 'aside' | ''>(''),
  pageKind = ref<PageKind>('document')
const draft = reactive({
  id: '',
  path: '',
  metadata: emptyMetadata(),
  body: '',
  state: '' as ContentPage['state'] | '',
})
const canSave = computed(() => Boolean(draft.path.trim() && draft.body.trim()))
const selectedPageType = computed(() => pageTypes.find((type) => type.value === pageKind.value)!)
const pagePrefix = computed(() => selectedPageType.value.prefix)
const pageSlug = computed({
  get: () =>
    pagePrefix.value && draft.path.startsWith(pagePrefix.value)
      ? draft.path.slice(pagePrefix.value.length)
      : draft.path,
  set: (value: string) => {
    draft.path = `${pagePrefix.value}${value.replace(/^\/+/, '')}`
  },
})
const pathPlaceholder = computed(() =>
  pageKind.value === 'document' ? '例如 guides/getting-started' : '例如 evergrowth',
)
const filteredPages = computed(() => {
  const keyword = pageSearch.value.trim().toLocaleLowerCase()
  if (!keyword) return pages.value
  return pages.value.filter((page) => page.path.toLocaleLowerCase().includes(keyword))
})
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
  pageKind.value = pageType(page.path).value
}
function pageType(path: string) {
  return pageTypes.find((type) => type.prefix && path.startsWith(type.prefix)) || pageTypes[0]
}
function selectPageType(type: PageKind) {
  const previousPrefix = pagePrefix.value
  const slug =
    previousPrefix && draft.path.startsWith(previousPrefix)
      ? draft.path.slice(previousPrefix.length)
      : draft.path
  pageKind.value = type
  draft.path = `${pageTypes.find((item) => item.value === type)!.prefix}${slug}`
}
function newPage(type: PageKind = 'document') {
  draft.id = ''
  draft.path = ''
  draft.metadata = emptyMetadata()
  draft.body = ''
  draft.state = ''
  pageKind.value = type
  newPageMenuLocation.value = ''
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
