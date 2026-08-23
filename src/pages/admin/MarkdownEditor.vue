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
        {{ tool.label }}
      </button>
      <span class="flex-1"></span>
      <button
        class="cms-button min-h-8 px-2.5 py-1"
        type="button"
        @click="insertContainer('warning', '重要提示')"
      >
        警告
      </button>
      <button
        class="cms-button min-h-8 px-2.5 py-1"
        type="button"
        @click="insertContainer('info', '信息')"
      >
        信息
      </button>
      <button class="cms-button min-h-8 px-2.5 py-1" type="button" @click="insertDownload">
        下载组件
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
const model = defineModel<string>({ required: true })
const textarea = ref<HTMLTextAreaElement>()
const tools = [
  { name: '粗体', label: 'B', before: '**', after: '**', placeholder: '粗体文字' },
  { name: '斜体', label: 'I', before: '*', after: '*', placeholder: '斜体文字' },
  { name: '标题', label: 'H2', before: '## ', after: '', placeholder: '标题' },
  { name: '链接', label: '链接', before: '[', after: '](https://)', placeholder: '链接文字' },
  { name: '代码', label: '代码', before: '`', after: '`', placeholder: '代码' },
  { name: '列表', label: '列表', before: '- ', after: '', placeholder: '列表项' },
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
    "{ id: 'curseforge', text: '下载地图和汉化', link: 'https://www.curseforge.com/minecraft/worlds/evergrowth/files/7111682' },\n  { id: 'lazy', link: 'https://www.curseforge.com/minecraft/worlds/evergrowth/files/7111682' }",
  )
}
</script>
