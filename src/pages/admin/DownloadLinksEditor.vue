<template>
  <section class="download-editor" aria-labelledby="download-editor-title">
    <header class="download-editor-header">
      <div>
        <h3 id="download-editor-title">
          下载链接
          <span class="download-count">{{ config.methods.length }}</span>
        </h3>
        <p>配置页面上的下载入口，保存后立即生效。</p>
      </div>
      <div v-if="pageId" class="download-actions">
        <button class="cms-button" type="button" :disabled="busy || !loaded" @click="addMethod">
          <Icon icon="lucide:plus" />
          添加方式
        </button>
        <button
          class="cms-primary-button"
          type="button"
          :disabled="busy || !loaded || !dirty"
          @click="save"
        >
          <Icon
            :icon="busy ? 'lucide:loader-circle' : 'lucide:check'"
            :class="{ 'animate-spin': busy }"
          />
          {{ busy ? '保存中' : '保存链接' }}
        </button>
      </div>
    </header>
    <p v-if="!pageId" class="download-empty">先保存页面，即可添加下载链接。</p>
    <template v-else>
      <div v-if="error" class="download-error" role="alert">
        <Icon icon="lucide:circle-alert" />
        {{ error }}
        <button class="cms-button" type="button" :disabled="busy" @click="load">重新加载</button>
      </div>
      <p v-if="busy && !loaded" class="download-empty" role="status">正在加载下载链接…</p>
      <div v-else-if="loaded && !config.methods.length" class="download-empty">
        <Icon icon="lucide:link" />
        尚未添加下载方式，点击右上角「添加方式」。
      </div>
      <fieldset
        v-for="(method, index) in config.methods"
        :key="index"
        class="download-card"
        :disabled="busy"
      >
        <div class="download-card-top">
          <div class="download-platform">
            <SelectMenu
              :model-value="platform(method)"
              :options="platforms"
              :aria-label="`下载方式 ${index + 1}`"
              variant="flat"
              style="--select-width: 100%; --select-menu-min-width: 100%"
              @update:model-value="changePlatform(method, $event)"
            />
          </div>
          <label class="cms-label download-caption">
            按钮文字
            <input
              v-model="method.text"
              class="cms-field"
              :placeholder="platform(method) === 'lazy' ? '懒汉下载' : '例如：下载汉化'"
            />
          </label>
          <button
            class="download-remove"
            type="button"
            :aria-label="`删除下载方式 ${index + 1}`"
            title="删除此方式"
            @click="config.methods.splice(index, 1)"
          >
            <Icon icon="lucide:trash-2" />
          </button>
        </div>
        <div v-if="platform(method) === 'drive'" class="download-urls">
          <label class="cms-label">
            蓝奏云链接
            <input
              v-model="method.lanzouLink"
              class="cms-field"
              type="url"
              placeholder="https://…"
            />
          </label>
          <label class="cms-label">
            夸克网盘链接
            <input
              v-model="method.quarkLink"
              class="cms-field"
              type="url"
              placeholder="https://pan.quark.cn/s/…"
            />
          </label>
        </div>
        <label v-else class="cms-label">
          {{ platform(method) === 'lazy' ? '原有懒汉下载链接' : '下载地址' }}
          <input v-model="method.link" class="cms-field" type="url" placeholder="https://…" />
        </label>
        <div v-if="platform(method) === 'lazy'" class="download-resource-note">
          <Icon icon="lucide:folder-open" />
          <span>项目目录和最新文件在资源管理中选择，配置后会替代这里的链接。</span>
          <a href="https://vmpm.vmct.top/resources" target="_blank" rel="noopener">
            资源管理
            <Icon icon="lucide:arrow-up-right" />
          </a>
        </div>
        <details class="download-advanced">
          <summary>
            <Icon icon="lucide:chevron-right" />
            高级设置
          </summary>
          <div class="download-advanced-fields">
            <label v-if="platform(method) === '__custom__'" class="cms-label">
              方式标识
              <input v-model="method.id" class="cms-field" placeholder="例如：download-1" />
            </label>
            <label class="cms-label">
              补充说明
              <input
                v-model="method.subText"
                class="cms-field"
                placeholder="可选，显示在按钮下方"
              />
            </label>
            <label class="cms-label">
              自定义图标
              <input v-model="method.icon" class="cms-field" placeholder="可选，留空使用默认图标" />
            </label>
            <template v-if="platform(method) === 'drive'">
              <label class="cms-label">
                备用下载地址
                <input v-model="method.link" class="cms-field" placeholder="可选" />
              </label>
              <label class="cms-label">
                内嵌懒汉链接
                <input v-model="method.lazyLink" class="cms-field" placeholder="可选" />
              </label>
            </template>
          </div>
        </details>
      </fieldset>
      <footer v-if="loaded" class="download-editor-footer">
        <span class="download-hint">
          <Icon icon="lucide:code" />
          正文只需
          <code>&lt;DownloadLinks/&gt;</code>
        </span>
        <span v-if="dirty" class="download-unsaved" role="status">有未保存的链接修改</span>
        <span v-else-if="saved" class="download-saved" role="status">
          <Icon icon="lucide:circle-check" />
          已保存
        </span>
      </footer>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import SelectMenu from '@/components/SelectMenu.vue'
import { getDownloads, saveDownloads, type DownloadConfiguration } from '@/api/contentAdmin'
import type { DownloadMethodSource } from '@/components/DownloadPage/downloadMethods'
const props = defineProps<{ pageId: string }>()
const config = ref<DownloadConfiguration>({ methods: [], version: 0 })
const busy = ref(false)
const loaded = ref(false)
const error = ref('')
const saved = ref(false)
const baseline = ref('[]')
const dirty = computed(() => JSON.stringify(config.value.methods) !== baseline.value)
const driveIds = new Set(['quark-lanzou', 'lanzou-quake', 'lanzou-quark-mapdl'])
const platforms = [
  { value: 'drive', label: '蓝奏云 / 夸克', icon: 'lucide:cloud-download' },
  { value: 'lazy', label: '懒汉下载', icon: 'lucide:folder-down' },
  { value: 'lanzou', label: '蓝奏云', icon: '/imgs/svg/lanzou.svg' },
  { value: 'baidu-drive', label: '百度网盘', icon: '/imgs/svg/baidu-drive.svg' },
  { value: 'curseforge', label: 'CurseForge', icon: '/imgs/svg/curseforge.svg' },
  { value: 'mediafire', label: 'MediaFire', icon: '/imgs/svg/mediafire.svg' },
  { value: '__custom__', label: '自定义链接', icon: 'lucide:link' },
]
function platform(method: DownloadMethodSource) {
  if (driveIds.has(method.id || '')) return 'drive'
  return platforms.some((option) => option.value === method.id) ? method.id! : '__custom__'
}
function changePlatform(method: DownloadMethodSource, value: string) {
  const id = value === 'drive' ? 'quark-lanzou' : value === '__custom__' ? nextCustomId() : value
  method.id = id
  if (!method.text) method.text = value === 'lazy' ? '懒汉下载' : '下载汉化'
}
function nextCustomId() {
  let number = 1
  while (config.value.methods.some((method) => method.id === `download-${number}`)) number++
  return `download-${number}`
}
function addMethod() {
  const id = !config.value.methods.some((method) => driveIds.has(method.id || ''))
    ? 'quark-lanzou'
    : !config.value.methods.some((method) => method.id === 'lazy')
      ? 'lazy'
      : nextCustomId()
  config.value.methods.push({ id, text: id === 'lazy' ? '懒汉下载' : '下载汉化' })
}
async function load() {
  if (!props.pageId) return
  busy.value = true
  error.value = ''
  saved.value = false
  try {
    config.value = await getDownloads(props.pageId)
    baseline.value = JSON.stringify(config.value.methods)
    loaded.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    busy.value = false
  }
}
async function save() {
  busy.value = true
  error.value = ''
  saved.value = false
  try {
    config.value = await saveDownloads(props.pageId, config.value)
    baseline.value = JSON.stringify(config.value.methods)
    saved.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    busy.value = false
  }
}
onMounted(load)
</script>

<style scoped>
.download-editor {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--switcher-border);
  border-radius: 12px;
  background: var(--bg-alt);
}
.download-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.download-editor-header h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  color: var(--text-1);
}
.download-editor-header p {
  margin: 5px 0 0;
  font-size: 13px;
  color: var(--text-muted);
}
.download-count {
  padding: 1px 7px;
  border-radius: 6px;
  background: var(--bg-soft);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
}
.download-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.download-actions svg {
  margin-right: 6px;
  width: 16px;
  height: 16px;
}
.download-card {
  display: grid;
  gap: 12px;
  min-width: 0;
  margin: 0;
  padding: 14px;
  border: 1px solid var(--switcher-border);
  border-radius: 10px;
  background: var(--bg-soft);
}
.download-card-top {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr) 34px;
  gap: 12px;
  align-items: end;
}
.download-urls,
.download-advanced-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.download-editor :deep(.cms-field) {
  min-height: 38px;
  font-size: 14px;
  padding-top: 7px;
  padding-bottom: 7px;
}
.download-editor :deep(.cms-label) {
  font-size: 12px;
  color: var(--text-muted);
}
.download-remove {
  display: grid;
  place-items: center;
  width: 34px;
  height: 38px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.download-remove:hover {
  background: #dc262611;
  color: #dc2626;
}
.download-remove svg {
  width: 16px;
  height: 16px;
}
.download-resource-note {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted);
}
.download-resource-note > svg {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
}
.download-resource-note a {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  white-space: nowrap;
  color: var(--info-1);
  text-decoration: none;
}
.download-advanced summary {
  display: flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  cursor: pointer;
  list-style: none;
  font-size: 12px;
  color: var(--text-muted);
}
.download-advanced summary::-webkit-details-marker {
  display: none;
}
.download-advanced summary svg {
  width: 14px;
  height: 14px;
  transition: transform 0.15s;
}
.download-advanced[open] summary svg {
  transform: rotate(90deg);
}
.download-advanced-fields {
  padding-top: 12px;
}
.download-editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}
.download-hint,
.download-saved {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.download-hint svg,
.download-saved svg {
  width: 14px;
  height: 14px;
}
.download-hint code {
  font-size: 11px;
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--bg-soft);
}
.download-saved {
  color: #059669;
}
.download-unsaved {
  color: var(--info-1);
}
.download-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  margin: 0;
  border: 1px dashed var(--switcher-border);
  border-radius: 10px;
  font-size: 13px;
  color: var(--text-muted);
}
.download-error {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #dc2626;
}
.download-error button {
  margin-left: auto;
}
@media (max-width: 640px) {
  .download-editor-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }
  .download-actions {
    width: 100%;
  }
  .download-actions button {
    flex: 1;
  }
  .download-card-top {
    grid-template-columns: minmax(0, 1fr) 34px;
  }
  .download-platform {
    grid-column: 1;
  }
  .download-remove {
    grid-column: 2;
    grid-row: 1;
  }
  .download-caption {
    grid-column: 1 / -1;
  }
  .download-urls,
  .download-advanced-fields {
    grid-template-columns: minmax(0, 1fr);
  }
  .download-resource-note {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
