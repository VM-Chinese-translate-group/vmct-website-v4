<template>
  <section
    class="grid gap-4 rounded-2xl border border-[var(--switcher-border)] bg-[var(--bg-soft)] p-4 max-sm:p-3"
  >
    <template v-if="itemId">
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="cms-button" @click="openItem('')">返回征集列表</button>
        <h2 class="m-0 break-all text-lg">{{ item?.display_name || '征集项目' }}</h2>
        <span v-if="item" class="text-sm text-[var(--text-2)]">{{ item.vote_count }} 票</span>
        <button v-if="item" type="button" class="cms-button" @click="openEditor(item, 'items')">
          编辑项目
        </button>
      </div>
      <code class="break-all text-xs text-[var(--text-muted)]">{{ itemId }}</code>
      <div class="flex flex-wrap gap-2" role="group" aria-label="关联记录">
        <button
          v-for="(collection, key) in collections"
          :key="key"
          type="button"
          class="cms-button"
          :aria-pressed="section === key"
          :class="{ 'border-[var(--info-1)]! text-[var(--info-1)]!': section === key }"
          @click="selectSection(key)"
        >
          {{ collection.label }}
        </button>
      </div>
    </template>
    <form v-else class="flex flex-wrap items-end gap-2" @submit.prevent="search">
      <label class="cms-label min-w-48 flex-1">
        搜索项目
        <input
          v-model="searchText"
          class="cms-field"
          maxlength="120"
          placeholder="名称、别名或 ID"
        />
      </label>
      <label class="cms-label">
        状态
        <select v-model="searchStatus" class="cms-field">
          <option value="">全部</option>
          <option v-for="(label, key) in statuses" :key="key" :value="key">{{ label }}</option>
        </select>
      </label>
      <button type="submit" class="cms-button">筛选</button>
    </form>

    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="m-0 text-lg">{{ activeTable.label }}</h2>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="cms-button" :disabled="loading" @click="reload()">刷新</button>
        <button
          type="button"
          class="cms-primary-button"
          :disabled="Boolean(itemId && !item)"
          @click="openEditor()"
        >
          新增{{ activeTable.singular }}
        </button>
      </div>
    </div>
    <p v-if="notice" class="m-0 text-sm" role="status">{{ notice }}</p>
    <p v-if="error" class="m-0 text-sm text-[var(--warning-1)]" role="alert">{{ error }}</p>
    <p v-if="loading" class="m-0 text-sm" role="status">正在加载…</p>
    <div v-if="rows.length" class="overflow-x-auto" :aria-busy="loading">
      <table class="w-full border-collapse text-left text-sm">
        <thead>
          <tr class="border-b border-[var(--switcher-border)]">
            <th
              v-for="column in activeTable.columns"
              :key="column.key"
              class="px-3 py-2"
              scope="col"
            >
              {{ column.label }}
            </th>
            <th class="px-3 py-2" scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="String(row[activeTable.key])"
            class="border-b border-[var(--switcher-border)]"
          >
            <td
              v-for="column in activeTable.columns"
              :key="column.key"
              class="max-w-96 break-all px-3 py-2"
            >
              {{ cell(row, column.key) }}
            </td>
            <td class="px-3 py-2">
              <div class="flex gap-1.5 whitespace-nowrap">
                <button
                  v-if="!itemId"
                  type="button"
                  class="cms-button"
                  @click="openItem(String(row.id))"
                >
                  关联记录
                </button>
                <button type="button" class="cms-button" @click="openEditor(row)">编辑</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else-if="!loading && !error" class="m-0 text-sm text-[var(--text-2)]">暂无记录。</p>
    <nav class="flex flex-wrap items-center gap-2" aria-label="征集管理分页">
      <button
        type="button"
        class="cms-button"
        :disabled="loading || page === 1"
        @click="goToPage(page - 1)"
      >
        上一页
      </button>
      <span class="text-sm">第 {{ page }} 页</span>
      <button
        type="button"
        class="cms-button"
        :disabled="loading || !hasMore"
        @click="goToPage(page + 1)"
      >
        下一页
      </button>
    </nav>
  </section>

  <BaseDialog
    :open="Boolean(editing)"
    :title="`${editing?.row ? '编辑' : '新增'}${editTable.singular}`"
    close-label="关闭"
    :close-on-backdrop="!saving"
    :close-on-escape="!saving"
    :show-close="!saving"
    @update:open="
      (open) => {
        if (!open && !saving) editing = null
      }
    "
  >
    <form v-if="editing" class="grid gap-3" @submit.prevent="save">
      <p v-if="editError" class="m-0 text-sm text-[var(--warning-1)]" role="alert">
        {{ editError }}
      </p>
      <template v-for="field in editTable.fields" :key="field.key">
        <fieldset v-if="field.key === 'subtypes'" class="min-w-0 m-0 border-0 p-0">
          <legend class="mb-1.5 p-0 text-sm font-600 text-[var(--text-2)]">
            {{ field.label }}
          </legend>
          <div class="flex flex-wrap gap-x-4 gap-y-2">
            <label
              v-for="subtype in availableSubtypes"
              :key="subtype"
              class="flex items-center gap-1.5 text-sm"
            >
              <input v-model="selectedSubtypes" type="checkbox" :value="subtype" />
              {{ subtypeLabels[subtype] }}
            </label>
          </div>
        </fieldset>
        <label v-else class="cms-label">
          {{ field.label }}
          <select
            v-if="field.options"
            v-model="form[field.key]"
            class="cms-field"
            :required="field.required"
            @change="field.key === 'category' && (selectedSubtypes = [])"
          >
            <option v-if="!field.required" value="">无</option>
            <option v-for="option in field.options" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <textarea
            v-else-if="field.key === 'note'"
            v-model="form[field.key]"
            class="cms-field"
            :maxlength="field.maxlength"
            rows="3"
          />
          <input
            v-else
            v-model="form[field.key]"
            class="cms-field"
            :type="field.type || 'text'"
            :required="field.required"
            :maxlength="field.maxlength"
            :readonly="section === 'votes' && field.key === 'voter_hash' && Boolean(editing.row)"
          />
        </label>
      </template>
      <div class="mt-2 flex flex-wrap justify-end gap-2">
        <button
          v-if="editing.row"
          type="button"
          class="cms-danger-button"
          :disabled="saving"
          @click="remove"
        >
          删除{{ editTable.singular }}
        </button>
        <button type="button" class="cms-button" :disabled="saving" @click="editing = null">
          取消
        </button>
        <button type="submit" class="cms-primary-button" :disabled="saving">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>
    </form>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import BaseDialog from '@/components/BaseDialog.vue'
import {
  changeAdminFeedback,
  getAdminFeedbackItem,
  listAdminFeedback,
  type FeedbackAdminCollection,
  type FeedbackAdminRow,
} from '@/api/contentAdmin'

type Section = 'items' | FeedbackAdminCollection
type Option = { value: string | number; label: string }
type Column = { key: string; label: string }
type Field = Column & { options?: Option[]; required?: boolean; maxlength?: number; type?: string }
type Table = { label: string; singular: string; key: string; columns: Column[]; fields: Field[] }

const categories = { modpack: '整合包', map: '地图', other: '其他' }
const statuses = {
  candidate: '候选',
  planned: '已计划',
  translating: '翻译中',
  completed: '已完成',
  hidden: '已隐藏',
}
const subtypeLabels: Record<string, string> = {
  technology: '科技',
  adventure: '冒险',
  kitchen_sink: '综合',
  magic: '魔法',
  puzzle: '解谜',
  minigame: '小游戏',
  horror: '恐怖',
  parkour: '跑酷',
  other: '其他',
}
const subtypeOptions: Record<string, string[]> = {
  modpack: ['technology', 'adventure', 'kitchen_sink', 'magic', 'other'],
  map: ['puzzle', 'minigame', 'adventure', 'horror', 'parkour', 'other'],
  other: ['other'],
}
const results = { created: '创建项目', merged: '合并到已有项目' }
const platforms = ['CurseForge', 'Modrinth', 'Planet Minecraft', 'Minecraft Maps', 'MapVerse']
const options = (values: Record<string, string>) =>
  Object.entries(values).map(([value, label]) => ({ value, label }))
const optionFlag = (yes: string, no: string) => [
  { value: 1, label: yes },
  { value: 0, label: no },
]
const categoryField = {
  key: 'category',
  label: '分类',
  options: options(categories),
  required: true,
}
const subtypeField = { key: 'subtypes', label: '类型' }
const voterField = { key: 'voter_hash', label: '访客哈希', required: true, maxlength: 64 }
const created = { key: 'created_at', label: '创建时间' }
const itemTable: Table = {
  label: '征集项目',
  singular: '项目',
  key: 'id',
  columns: [
    { key: 'display_name', label: '名称' },
    categoryField,
    subtypeField,
    { key: 'status', label: '状态' },
    { key: 'vote_count', label: '票数' },
  ],
  fields: [
    { key: 'display_name', label: '项目名称', required: true, maxlength: 120 },
    categoryField,
    subtypeField,
    { key: 'status', label: '状态', options: options(statuses), required: true },
    { key: 'cover_url', label: '封面地址', type: 'url', maxlength: 2048 },
    {
      key: 'cover_platform',
      label: '封面平台',
      options: platforms.map((value) => ({ value, label: value })),
    },
  ],
}
const collections: Record<FeedbackAdminCollection, Table> = {
  sources: {
    label: '来源链接',
    singular: '来源',
    key: 'normalized_url',
    columns: [
      { key: 'platform', label: '平台' },
      { key: 'url', label: '链接' },
      { key: 'is_primary', label: '主要来源' },
      created,
    ],
    fields: [
      { key: 'url', label: '项目链接', type: 'url', required: true, maxlength: 2048 },
      { key: 'is_primary', label: '主要来源', options: optionFlag('是', '否'), required: true },
    ],
  },
  aliases: {
    label: '项目别名',
    singular: '别名',
    key: 'normalized_alias',
    columns: [{ key: 'alias', label: '别名' }, created],
    fields: [{ key: 'alias', label: '别名', required: true, maxlength: 120 }],
  },
  submissions: {
    label: '提交记录',
    singular: '提交记录',
    key: 'id',
    columns: [
      { key: 'original_name', label: '原始名称' },
      categoryField,
      subtypeField,
      { key: 'note', label: '备注' },
      { key: 'result', label: '处理结果' },
      created,
    ],
    fields: [
      { key: 'original_name', label: '原始名称', required: true, maxlength: 120 },
      categoryField,
      subtypeField,
      { key: 'note', label: '备注', maxlength: 500 },
      voterField,
      { key: 'result', label: '处理结果', options: options(results), required: true },
    ],
  },
  votes: {
    label: '投票记录',
    singular: '投票记录',
    key: 'voter_hash',
    columns: [
      voterField,
      { key: 'active', label: '状态' },
      { key: 'updated_at', label: '更新时间' },
    ],
    fields: [
      voterField,
      { key: 'active', label: '状态', options: optionFlag('有效', '已撤回'), required: true },
    ],
  },
}

const itemId = ref('')
const item = ref<FeedbackAdminRow>()
const section = ref<Section>('items')
const activeTable = computed(() =>
  section.value === 'items' ? itemTable : collections[section.value],
)
const rows = ref<FeedbackAdminRow[]>([])
const page = ref(1)
const itemPage = ref(1)
const hasMore = ref(false)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const searchText = ref('')
const searchStatus = ref('')
let filters = new URLSearchParams()
let requestId = 0
const editing = ref<{ section: Section; row?: FeedbackAdminRow } | null>(null)
const editTable = computed(() => {
  const current = editing.value?.section
  return !current || current === 'items' ? itemTable : collections[current]
})
const form = ref<FeedbackAdminRow>({})
const selectedSubtypes = ref<string[]>([])
const availableSubtypes = computed(() => subtypeOptions[String(form.value.category)] || [])
const editError = ref('')

function cell(row: FeedbackAdminRow, key: string) {
  const value = row[key]
  if (key === 'category') return categories[value as keyof typeof categories] || value
  if (key === 'status') return statuses[value as keyof typeof statuses] || value
  if (key === 'result') return results[value as keyof typeof results] || value
  if (key === 'subtypes')
    return (
      String(value || row.subtype || '')
        .split(',')
        .filter(Boolean)
        .map((type) => subtypeLabels[type] || type)
        .join('、') || '—'
    )
  if (key === 'is_primary') return value === 1 ? '是' : '否'
  if (key === 'active') return value === 1 ? '有效' : '已撤回'
  return value ?? '—'
}

async function reload(clear = false) {
  const current = ++requestId
  const id = itemId.value || undefined
  const collection = section.value === 'items' ? undefined : section.value
  const params = new URLSearchParams(id ? undefined : filters)
  params.set('page', String(page.value))
  if (clear) {
    rows.value = []
    hasMore.value = false
    notice.value = ''
  }
  error.value = ''
  loading.value = true
  try {
    const [listing, detail] = await Promise.all([
      listAdminFeedback(params, id, collection),
      id ? getAdminFeedbackItem(id) : null,
    ])
    if (current !== requestId) return
    rows.value = listing.rows
    hasMore.value = listing.hasMore
    item.value = detail?.item
  } catch (cause) {
    if (current === requestId) error.value = message(cause)
  } finally {
    if (current === requestId) loading.value = false
  }
}

function search() {
  filters = new URLSearchParams({ q: searchText.value, status: searchStatus.value })
  goToPage(1)
}

function goToPage(nextPage: number) {
  page.value = nextPage
  void reload(true)
}

function openItem(id: string) {
  if (!itemId.value && id) itemPage.value = page.value
  itemId.value = id
  item.value = undefined
  section.value = id ? 'sources' : 'items'
  goToPage(id ? 1 : itemPage.value)
}

function selectSection(collection: FeedbackAdminCollection) {
  if (section.value === collection) return
  section.value = collection
  goToPage(1)
}

function openEditor(row?: FeedbackAdminRow, target = section.value) {
  const table = target === 'items' ? itemTable : collections[target]
  const defaults: FeedbackAdminRow = {
    category: item.value?.category || 'modpack',
    status: 'candidate',
    is_primary: 0,
    active: 1,
    result: 'merged',
  }
  form.value = Object.fromEntries(
    table.fields.map((field) => [
      field.key,
      row ? (row[field.key] ?? '') : (defaults[field.key] ?? ''),
    ]),
  )
  selectedSubtypes.value = String(
    row?.subtypes ||
      row?.subtype ||
      (target === 'submissions' ? item.value?.subtypes || item.value?.subtype || '' : ''),
  )
    .split(',')
    .filter(Boolean)
  editError.value = ''
  editing.value = { section: target, row }
}

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : '操作失败，请重试。'
}

async function persist(method: 'POST' | 'PUT' | 'DELETE') {
  const edit = editing.value
  if (!edit || saving.value) return
  const collection = edit.section === 'items' ? undefined : edit.section
  const key = edit.row ? String(edit.row[editTable.value.key]) : undefined
  saving.value = true
  editError.value = ''
  try {
    const values =
      method === 'DELETE'
        ? undefined
        : { ...form.value, subtypes: selectedSubtypes.value.join(',') }
    await changeAdminFeedback(
      method,
      collection ? itemId.value : key,
      collection,
      collection ? key : undefined,
      values,
    )
    editing.value = null
    if (method === 'DELETE' && !collection && itemId.value) {
      openItem('')
    } else {
      if (method === 'DELETE' && rows.value.length === 1 && page.value > 1) page.value--
      if (method === 'POST') page.value = 1
      await reload()
    }
    notice.value = method === 'DELETE' ? '记录已删除。' : '记录已保存。'
  } catch (cause) {
    editError.value = message(cause)
  } finally {
    saving.value = false
  }
}

function save() {
  void persist(editing.value?.row ? 'PUT' : 'POST')
}

function remove() {
  const prompt =
    editing.value?.section === 'items'
      ? '删除此项目及其全部来源、别名、提交和投票记录？'
      : `删除此${editTable.value.singular}？`
  if (window.confirm(prompt)) void persist('DELETE')
}

onMounted(() => void reload())
onBeforeUnmount(() => {
  requestId++
})
</script>
