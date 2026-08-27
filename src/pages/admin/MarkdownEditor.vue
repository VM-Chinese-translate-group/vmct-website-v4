<template>
  <section class="grid content-start gap-2">
    <div
      class="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--switcher-border)] bg-[var(--bg-soft)] p-2"
    >
      <button
        v-for="tool in tools"
        :key="tool.name"
        type="button"
        :title="tool.name"
        class="cms-button min-h-8 px-2.5 py-1"
        @click="insert(tool.before, tool.after, tool.placeholder)"
      >
        <Icon :icon="tool.icon" width="17" height="17" aria-hidden="true" />
        <span class="sr-only">{{ tool.name }}</span>
      </button>
      <span class="flex-1"></span>
      <button
        class="cms-button min-h-8 px-2.5 py-1"
        type="button"
        title="插入警告提示块"
        aria-label="插入警告提示块"
        @click="insertContainer('warning', '重要提示')"
      >
        <Icon icon="lucide:triangle-alert" width="17" height="17" aria-hidden="true" />
        <span class="sr-only">警告</span>
      </button>
      <button
        class="cms-button min-h-8 px-2.5 py-1"
        type="button"
        title="插入信息提示块"
        aria-label="插入信息提示块"
        @click="insertContainer('info', '信息')"
      >
        <Icon icon="lucide:info" width="17" height="17" aria-hidden="true" />
        <span class="sr-only">信息</span>
      </button>
      <button
        class="cms-button min-h-8 px-2.5 py-1"
        type="button"
        title="下载组件"
        aria-label="下载组件"
        @click="insertDownload"
      >
        <Icon icon="lucide:download" width="17" height="17" aria-hidden="true" />
        <span class="sr-only">下载组件</span>
      </button>
    </div>
    <textarea
      ref="textarea"
      v-model="model"
      class="cms-field h-130 min-h-105 resize-y p-3 font-mono leading-relaxed"
      spellcheck="false"
      placeholder="Markdown 正文"
    />
  </section>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
const model = defineModel<string>({ required: true })
const textarea = ref<HTMLTextAreaElement>()
const tools = [
  { name: '粗体', icon: 'lucide:bold', before: '**', after: '**', placeholder: '粗体文字' },
  { name: '斜体', icon: 'lucide:italic', before: '*', after: '*', placeholder: '斜体文字' },
  { name: '标题', icon: 'lucide:heading-2', before: '## ', after: '', placeholder: '标题' },
  { name: '链接', icon: 'lucide:link', before: '[', after: '](https://)', placeholder: '链接文字' },
  { name: '代码', icon: 'lucide:code-2', before: '`', after: '`', placeholder: '代码' },
  { name: '列表', icon: 'lucide:list', before: '- ', after: '', placeholder: '列表项' },
]
function insert(before: string, after: string, placeholder: string) {
  const el = textarea.value
  const start = el?.selectionStart ?? model.value.length
  const end = el?.selectionEnd ?? start
  const selected = model.value.slice(start, end) || placeholder
  model.value = model.value.slice(0, start) + before + selected + after + model.value.slice(end)
  requestAnimationFrame(() => {
    el?.focus()
    el?.setSelectionRange(start + before.length, start + before.length + selected.length)
  })
}
function insertContainer(type: string, title: string) {
  insert(`\n::: ${type} ${title}\n`, '\n:::\n', '内容')
}
function insertDownload() {
  insert(
    '\n<DownloadLinks :methods="[\n  ',
    '\n]" />\n',
    "{ id: 'curseforge', text: '下载地图和汉化', link: 'https://www.curseforge.com/minecraft/worlds/evergrowth/files/7111682' }",
  )
}
</script>
