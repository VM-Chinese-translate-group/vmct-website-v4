<template>
  <section
    class="download-editor grid gap-3 p-4 [border:1px_solid_var(--switcher-border)] rounded-xl [background:var(--bg-alt)]"
    aria-labelledby="download-editor-title"
  >
    <header
      class="download-editor-header flex items-center justify-between gap-4 [&_h3]:flex [&_h3]:items-center [&_h3]:gap-2 [&_h3]:m-0 [&_h3]:text-[16px] [&_h3]:text-[var(--text-1)] [&_p]:m-[5px_0_0] [&_p]:text-[13px] [&_p]:text-[var(--text-muted)] max-[640px]:items-start max-[640px]:flex-col max-[640px]:gap-3"
    >
      <div>
        <h3 id="download-editor-title">
          下载链接
          <span
            class="download-count p-[1px_7px] rounded-md [background:var(--bg-soft)] text-[var(--text-muted)] text-[12px] font-500"
          >
            {{ config.methods.length }}
          </span>
        </h3>
        <p>配置页面上的下载入口，保存后立即生效。</p>
      </div>
      <div
        v-if="pageId"
        class="download-actions flex gap-2 shrink-0 [&_svg]:mr-[6px] [&_svg]:w-4 [&_svg]:h-4 max-[640px]:w-full max-[640px]:[&_button]:flex-1"
      >
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
    <p v-if="!pageId" class="download-empty vm-admin-downloads-download-empty">
      先保存页面，即可添加下载链接。
    </p>
    <template v-else>
      <div
        v-if="error"
        class="download-error flex items-center gap-2 text-[13px] text-[#dc2626] [&_button]:ml-auto"
        role="alert"
      >
        <Icon icon="lucide:circle-alert" />
        {{ error }}
        <button class="cms-button" type="button" :disabled="busy" @click="load">重新加载</button>
      </div>
      <p
        v-if="busy && !loaded"
        class="download-empty vm-admin-downloads-download-empty"
        role="status"
      >
        正在加载下载链接…
      </p>
      <div
        v-else-if="loaded && !config.methods.length"
        class="download-empty vm-admin-downloads-download-empty"
      >
        <Icon icon="lucide:link" />
        尚未添加下载方式，点击右上角「添加方式」。
      </div>
      <fieldset
        v-for="(method, index) in config.methods"
        :key="index"
        class="download-card grid gap-3 min-w-0 m-0 p-[14px] [border:1px_solid_var(--switcher-border)] rounded-[10px] [background:var(--bg-soft)]"
        :disabled="busy"
      >
        <div
          class="download-card-top grid grid-cols-[190px_minmax(0,_1fr)_34px] gap-3 [align-items:end] max-[640px]:grid-cols-[minmax(0,_1fr)_34px]"
        >
          <div class="download-platform max-[640px]:col-[1]">
            <SelectMenu
              :model-value="platform(method)"
              :options="platforms"
              :ariaLabel="`${$t('downloadModal.driveTitle')} ${index + 1}`"
              variant="flat"
              class="[--select-width:100%] [--select-menu-min-width:100%]"
              @update:model-value="changePlatform(method, String($event))"
            />
          </div>
          <label
            class="cms-label vm-admin-downloads-cms-label download-caption max-[640px]:col-[1_/_-1]"
          >
            按钮文字
            <input
              v-model="method.text"
              class="cms-field vm-admin-downloads-cms-field"
              :placeholder="
                $t(platform(method) === 'lazy' ? 'downloadModal.lazyTitle' : 'pack.downloadPatch')
              "
            />
          </label>
          <button
            class="download-remove grid place-items-center w-[34px] h-[38px] border-0 rounded-lg [background:transparent] text-[var(--text-muted)] cursor-pointer hover:[background:#dc262611] hover:text-[#dc2626] [&_svg]:w-4 [&_svg]:h-4 max-[640px]:col-[2] max-[640px]:[grid-row:1]"
            type="button"
            :aria-label="`删除下载方式 ${index + 1}`"
            title="删除此方式"
            @click="config.methods.splice(index, 1)"
          >
            <Icon icon="lucide:trash-2" />
          </button>
        </div>
        <div
          v-if="platform(method) === 'drive'"
          class="download-urls grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3 max-[640px]:grid-cols-[minmax(0,_1fr)]"
        >
          <label class="cms-label vm-admin-downloads-cms-label">
            {{ $t('downloadModal.lanzouTitle') }}
            <input
              v-model="method.lanzouLink"
              class="cms-field vm-admin-downloads-cms-field"
              type="url"
              placeholder="https://…"
            />
          </label>
          <label class="cms-label vm-admin-downloads-cms-label">
            {{ $t('downloadModal.quarkTitle') }}
            <input
              v-model="method.quarkLink"
              class="cms-field vm-admin-downloads-cms-field"
              type="url"
              placeholder="https://pan.quark.cn/s/…"
            />
          </label>
        </div>
        <label v-else class="cms-label vm-admin-downloads-cms-label">
          {{ platform(method) === 'lazy' ? '原有懒汉下载链接' : '下载地址' }}
          <input
            v-model="method.link"
            class="cms-field vm-admin-downloads-cms-field"
            type="url"
            placeholder="https://…"
          />
        </label>
        <div
          v-if="platform(method) === 'lazy'"
          class="download-resource-note flex items-center gap-[7px] text-[12px] leading-[1.6] text-[var(--text-muted)] [&_>_svg]:shrink-0 [&_>_svg]:w-[15px] [&_>_svg]:h-[15px] [&_a]:inline-flex [&_a]:items-center [&_a]:gap-[3px] [&_a]:ml-auto [&_a]:whitespace-nowrap [&_a]:text-[var(--info-1)] [&_a]:no-underline max-[640px]:items-start max-[640px]:flex-wrap"
        >
          <Icon icon="lucide:folder-open" />
          <span>项目目录和最新文件在资源管理中选择，配置后会替代这里的链接。</span>
          <a href="https://vmpm.vmct.top/resources" target="_blank" rel="noopener">
            资源管理
            <Icon icon="lucide:arrow-up-right" />
          </a>
        </div>
        <details
          class="download-advanced [&_summary]:flex [&_summary]:items-center [&_summary]:gap-1 [&_summary]:w-[fit-content] [&_summary]:cursor-pointer [&_summary]:[list-style:none] [&_summary]:text-[12px] [&_summary]:text-[var(--text-muted)] [&_summary::-webkit-details-marker]:hidden [&_summary_svg]:w-[14px] [&_summary_svg]:h-[14px] [&_summary_svg]:[transition:transform_0.15s] [&[open]_summary_svg]:[transform:rotate(90deg)]"
        >
          <summary>
            <Icon icon="lucide:chevron-right" />
            高级设置
          </summary>
          <div
            class="download-advanced-fields grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3 pt-3 max-[640px]:grid-cols-[minmax(0,_1fr)]"
          >
            <label
              v-if="platform(method) === '__custom__'"
              class="cms-label vm-admin-downloads-cms-label"
            >
              方式标识
              <input
                v-model="method.id"
                class="cms-field vm-admin-downloads-cms-field"
                placeholder="例如：download-1"
              />
            </label>
            <label class="cms-label vm-admin-downloads-cms-label">
              补充说明
              <input
                v-model="method.subText"
                class="cms-field vm-admin-downloads-cms-field"
                placeholder="可选，显示在按钮下方"
              />
            </label>
            <label class="cms-label vm-admin-downloads-cms-label">
              自定义图标
              <input
                v-model="method.icon"
                class="cms-field vm-admin-downloads-cms-field"
                placeholder="可选，留空使用默认图标"
              />
            </label>
            <template v-if="platform(method) === 'drive'">
              <label class="cms-label vm-admin-downloads-cms-label">
                备用下载地址
                <input
                  v-model="method.link"
                  class="cms-field vm-admin-downloads-cms-field"
                  placeholder="可选"
                />
              </label>
              <label class="cms-label vm-admin-downloads-cms-label">
                内嵌懒汉链接
                <input
                  v-model="method.lazyLink"
                  class="cms-field vm-admin-downloads-cms-field"
                  placeholder="可选"
                />
              </label>
            </template>
          </div>
        </details>
      </fieldset>
      <footer
        v-if="loaded"
        class="download-editor-footer flex items-center justify-between flex-wrap gap-2 text-[12px] text-[var(--text-muted)]"
      >
        <span
          class="download-hint inline-flex items-center gap-[5px] [&_svg]:w-[14px] [&_svg]:h-[14px] [&_code]:text-[11px] [&_code]:p-[2px_5px] [&_code]:rounded [&_code]:[background:var(--bg-soft)]"
        >
          <Icon icon="lucide:code" />
          正文只需
          <code>&lt;DownloadLinks/&gt;</code>
        </span>
        <span v-if="dirty" class="download-unsaved text-[var(--info-1)]" role="status">
          有未保存的链接修改
        </span>
        <span
          v-else-if="saved"
          class="download-saved inline-flex items-center gap-[5px] text-[#059669] [&_svg]:w-[14px] [&_svg]:h-[14px]"
          role="status"
        >
          <Icon icon="lucide:circle-check" />
          已保存
        </span>
      </footer>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@/icons'
import SelectMenu from '@/components/SelectMenu.vue'
import { getDownloads, saveDownloads, type DownloadConfiguration } from '@/api/contentAdmin'
import type { DownloadMethodSource } from '@/components/DownloadPage/downloadMethods'
const props = defineProps<{ pageId: string }>()
const { t } = useI18n()
const config = ref<DownloadConfiguration>({ methods: [], version: 0 })
const busy = ref(false)
const loaded = ref(false)
const error = ref('')
const saved = ref(false)
const baseline = ref('[]')
const dirty = computed(() => JSON.stringify(config.value.methods) !== baseline.value)
const driveIds = new Set(['quark-lanzou', 'lanzou-quake', 'lanzou-quark-mapdl'])
const platforms = computed(() => [
  {
    value: 'drive',
    label: `${t('downloadModal.lanzouTitle')} / ${t('downloadModal.quarkTitle')}`,
    icon: 'lucide:cloud-download',
  },
  { value: 'lazy', label: t('downloadModal.lazyTitle'), icon: 'lucide:folder-down' },
  { value: 'lanzou', label: t('downloadModal.lanzouTitle'), icon: '/imgs/svg/lanzou.svg' },
  { value: 'baidu-drive', label: '百度网盘', icon: '/imgs/svg/baidu-drive.svg' },
  { value: 'curseforge', label: 'CurseForge', icon: '/imgs/svg/curseforge.svg' },
  { value: 'mediafire', label: 'MediaFire', icon: '/imgs/svg/mediafire.svg' },
  { value: '__custom__', label: '自定义链接', icon: 'lucide:link' },
])
function platform(method: DownloadMethodSource) {
  if (driveIds.has(method.id || '')) return 'drive'
  return platforms.value.some((option) => option.value === method.id) ? method.id! : '__custom__'
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
