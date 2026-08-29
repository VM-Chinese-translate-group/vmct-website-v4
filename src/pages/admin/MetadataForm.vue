<template>
  <section
    class="grid gap-5 rounded-2xl border border-[var(--switcher-border)] bg-[var(--bg-alt)] p-5 shadow-[var(--vp-shadow-1)]"
  >
    <div>
      <h3 class="m-0 text-lg text-[var(--text-1)]">页面元数据</h3>
      <p class="mb-0 mt-1 text-sm text-[var(--text-2)]">
        这些信息会显示在页面标题区、资源列表和搜索结果中。
      </p>
    </div>
    <div class="grid grid-cols-2 gap-4 max-md:grid-cols-1">
      <label class="cms-label">
        标题
        <input v-model="model.title" class="cms-field" placeholder="XXX 汉化下载" />
        <small class="text-[var(--text-muted)]">默认按“XXX 汉化下载”填写。</small>
      </label>
      <label class="cms-label">
        英文名
        <input v-model="model.originalName" class="cms-field" placeholder="填写整合包英文原名" />
        <small class="text-[var(--text-muted)]">例如：Prominence II RPG: Hasturian Era</small>
      </label>
      <label class="cms-label">
        封面 / 图标 URL
        <input v-model="model.icon" class="cms-field" placeholder="/imgs/... 或 https://..." />
      </label>
      <label class="cms-label">
        更新日期
        <input
          v-model="calendarDate"
          class="cms-field cms-date-field"
          type="date"
          @click="openCalendar"
        />
      </label>
      <label v-if="pageKind !== 'document'" class="cms-label">
        发布状态
        <SelectMenu
          :model-value="model.statusType"
          :options="statusOptions"
          aria-label="发布状态"
          variant="flat"
          style="--select-width: 100%; --select-menu-min-width: 100%"
          @update:model-value="model.statusType = $event"
        />
      </label>
      <label v-if="pageKind !== 'document'" class="cms-label">
        加载器
        <SelectMenu
          :model-value="model.loader"
          :options="loaderOptions"
          aria-label="加载器"
          variant="flat"
          style="--select-width: 100%; --select-menu-min-width: 100%"
          @update:model-value="model.loader = $event"
        />
      </label>
      <label v-if="pageKind !== 'document'" class="cms-label">
        Minecraft 版本
        <input v-model="model.minecraft" class="cms-field" placeholder="例如 1.21.1" />
      </label>
      <label v-if="pageKind !== 'document'" class="cms-label">
        整合包版本
        <input v-model="model.pack" class="cms-field" placeholder="例如 2.3.1" />
      </label>
    </div>
    <label class="cms-label">
      简介
      <textarea v-model="model.description" class="cms-field" rows="3" />
    </label>
    <div class="flex flex-wrap gap-3">
      <label class="cms-check">
        <input v-model="model.featured" type="checkbox" />
        推荐显示
      </label>
      <label class="cms-check">
        <input v-model="model.search" type="checkbox" />
        搜索收录
      </label>
      <label v-if="pageKind === 'document'" class="cms-check">
        <input v-model="model.sidebar" type="checkbox" />
        侧栏显示
      </label>
    </div>
    <label class="cms-label">
      作者
      <div class="flex flex-wrap gap-2">
        <div v-for="(_, index) in model.authors" :key="index" class="flex min-w-48 flex-1 gap-1">
          <input v-model="model.authors[index]" class="cms-field" placeholder="作者名称" />
          <button
            class="cms-icon-button"
            type="button"
            title="删除作者"
            @click="model.authors.splice(index, 1)"
          >
            ×
          </button>
        </div>
        <button class="cms-button" type="button" @click="model.authors.push('')">
          ＋ 添加作者
        </button>
      </div>
    </label>
    <div class="grid gap-3 border-t border-[var(--switcher-border)] pt-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <strong>相关链接</strong>
        <button class="cms-button" type="button" @click="model.links.push(newLink())">
          ＋ 添加链接
        </button>
      </div>
      <div
        v-for="(link, index) in model.links"
        :key="index"
        class="grid grid-cols-[10rem_minmax(10rem,1fr)_minmax(14rem,2fr)_auto] items-end gap-2 rounded-xl border border-[var(--switcher-border)] bg-[var(--bg-soft)] p-3 max-lg:grid-cols-1 max-lg:items-stretch"
      >
        <div class="grid gap-2">
          <SelectMenu
            :model-value="selectedLinkPlatform(link.id)"
            :options="linkOptions"
            aria-label="链接平台"
            variant="flat"
            style="--select-width: 100%; --select-menu-min-width: 100%"
            @update:model-value="updateLinkPlatform(link, $event)"
          />
          <input
            v-if="selectedLinkPlatform(link.id) === '__custom__'"
            v-model="link.id"
            class="cms-field"
            placeholder="自定义平台标识"
          />
        </div>
        <div
          v-if="link.id === 'i18n'"
          class="col-span-2 flex min-h-11 items-center rounded-lg border border-[var(--switcher-border)] bg-[var(--bg-alt)] px-3 text-sm text-[var(--text-2)] max-lg:col-span-1"
        >
          显示为“i18n 下载”，链接由网站自动提供，无需填写。
        </div>
        <label v-else-if="link.id === 'paratranz'" class="cms-label col-span-2 max-lg:col-span-1">
          项目 ID
          <input
            v-model="link.project"
            class="cms-field"
            inputmode="numeric"
            placeholder="例如 1234"
          />
        </label>
        <template v-else>
          <label class="cms-label">
            显示文字
            <input v-model="link.text" class="cms-field" placeholder="例如：介绍视频" />
          </label>
          <label class="cms-label">
            链接地址
            <input v-model="link.link" class="cms-field" type="url" placeholder="https://..." />
          </label>
        </template>
        <button class="cms-danger-button" type="button" @click="model.links.splice(index, 1)">
          删除
        </button>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import SelectMenu from '@/components/SelectMenu.vue'
import type { ContentLink, ContentMetadata } from './types'
import { LINK_OPTIONS, LOADER_OPTIONS, STATUS_OPTIONS } from './contentConfig'
const model = defineModel<ContentMetadata>({ required: true })
defineProps<{ pageKind: 'document' | 'modpack' | 'map' }>()
const calendarDate = computed({
  get: () => {
    const match = model.value.updateDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : ''
  },
  set: (value) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    model.value.updateDate = match ? `${match[1]}-${Number(match[2])}-${Number(match[3])}` : ''
  },
})
const statusOptions = STATUS_OPTIONS
const loaderOptions = LOADER_OPTIONS
const linkOptions = LINK_OPTIONS
function selectedLinkPlatform(id: string) {
  return linkOptions.some((option) => option.value === id) ? id : '__custom__'
}
function updateLinkPlatform(link: ContentLink, value: string) {
  link.id = value === '__custom__' ? '' : value
  if (link.id === 'i18n') {
    link.text = ''
    link.link = ''
    link.project = ''
  } else if (link.id === 'paratranz') {
    link.text = ''
    link.link = ''
  } else {
    link.project = ''
  }
}

function openCalendar(event: MouseEvent) {
  event.currentTarget instanceof HTMLInputElement && event.currentTarget.showPicker()
}

function newLink(): ContentLink {
  return { id: 'curseforge', text: '', link: '', icon: '', project: '' }
}
</script>

<style scoped>
.cms-date-field::-webkit-calendar-picker-indicator {
  display: none;
}
</style>
