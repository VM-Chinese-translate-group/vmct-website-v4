# 通用对话框（BaseDialog）

[`../../src/components/BaseDialog.vue`](../../src/components/BaseDialog.vue) 是站内可复用的对话框框架；[`../../src/composables/useDialogLayer.ts`](../../src/composables/useDialogLayer.ts) 管理层级及背景隔离。目前已接入 `translation-feedback` 的“提交新项目”，其他现有对话框暂未迁移。

## 快速开始

```vue
<script setup lang="ts">
import { ref } from 'vue'
import BaseDialog from '@/components/BaseDialog.vue'

const open = ref(false)
</script>

<template>
  <button id="project-details-trigger" type="button" @click="open = true">项目详情</button>
  <BaseDialog
    v-model:open="open"
    title="项目详情"
    close-label="关闭对话框"
    return-focus="#project-details-trigger"
  >
    <p>这里放置项目内容。</p>
    <template #footer="{ close }">
      <button type="button" @click="close">关闭</button>
    </template>
  </BaseDialog>
</template>
```

## 接口

| 属性                                   | 用途                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `v-model:open`                         | 必填，控制显示状态；关闭请求更新为 `false`                                               |
| `title`、`close-label`                 | 必填，分别为标题和关闭按钮的无障碍名称，由调用方提供翻译                                 |
| `id`                                   | 可选面板 ID；未提供时自动生成唯一 ID，标题和说明自动关联                                 |
| `description`                          | 可选标题说明                                                                             |
| `width`                                | 面板宽度，默认 `550px`，超出可用视口时自动收窄                                           |
| `as`                                   | 原生面板元素，默认 `section`，可设为 `form`                                              |
| `role`                                 | 默认 `dialog`，确认类内容可使用 `alertdialog`                                            |
| `show-close`                           | 是否显示右上角关闭按钮，默认 `true`                                                      |
| `close-on-escape`、`close-on-backdrop` | 是否允许 Esc / 点击遮罩关闭，均默认 `true`                                               |
| `initial-focus`                        | 面板内的 CSS 选择器；默认优先聚焦 `autofocus` 元素，其次为关闭按钮、首个可聚焦元素或面板 |
| `return-focus`                         | 关闭后恢复焦点的页面 CSS 选择器；默认回到打开前的焦点元素                                |

- 默认插槽放正文，`title`、`description` 插槽可自定义标题区域，`footer` 插槽放操作区。不提供 `footer` 时不渲染底栏。
- 默认和 `footer` 插槽均提供 `close()`，用于发起关闭请求。业务数据、提交状态和验证仍由调用方管理。
- 表单使用 `as="form"` 与 `@submit.prevent="submitForm"`，把 `type="submit"` 按钮放在 `footer` 中；不要再嵌套 `<form>`。原生必填验证仍生效。
- 其余属性及原生事件透传到面板，例如 `aria-busy`、`@submit`。
- `close(reason)` 事件仅在组件发起关闭请求时触发，原因为 `close-button`、`escape`、`backdrop` 或插槽调用的 `action`。`opened`、`closed` 分别在入场、离场动画结束时触发。

## 布局与交互

框架统一负责 Teleport 到 `#vmct-overlays`、遮罩、标题栏、固定操作区、正文按需滚动、视口高度限制、滚动锁、背景 `inert` 隔离、Tab 焦点循环及关闭后的焦点恢复。多层对话框仅最顶层响应键盘和焦点，关闭下层不会解除上层的滚动锁；组件卸载也会释放资源。

样式统一维护在独立 CSS 文件中：框架样式见 [`BaseDialog.css`](../../src/styles/BaseDialog.css)，提交页面样式见 [`TranslationFeedbackLayout.css`](../../src/styles/TranslationFeedbackLayout.css)，多选菜单样式见 [`MultiSelectMenu.css`](../../src/styles/MultiSelectMenu.css)。Vue 文件的 `<style scoped>` 中只保留对应的 `@import`，不直接编写 CSS 规则；调整样式时仍保留组件作用域。

## 表单与成功结果切换

同一个对话框可以通过业务状态在填写界面和成功结果之间切换，无需叠加第二个弹窗。实现示例见 [`TranslationFeedbackLayout.vue`](../../src/layout/TranslationFeedbackLayout.vue) 的“提交新项目”：

- 填写时使用 `as="form"`，保留原生验证和提交事件；失败时显示错误并保留填写内容。
- 成功后切换为 `as="section"`，更新标题，正文显示成功图标、已提交的项目名称，以及新建、合并或点赞对应的结果说明，不再显示表单或提交按钮。
- “继续提交”返回填写界面，保留分类和类型，原名、来源链接和补充说明已在成功时清空，并聚焦原名输入框。
- “完成”通过插槽的 `close()` 关闭对话框，由框架恢复入口焦点。再次打开时清除旧的成功状态；未成功提交的草稿不会因关闭而清空。
- 该示例的两个底栏按钮始终等宽、等高；桌面宽度为 `160px`，窄屏时等分可用空间，保留主次配色。提交按钮仅显示文字，提交中通过文字和禁用状态反馈。

这些结果状态、内容重置及切换后的焦点由调用方管理；`BaseDialog` 只负责通用的容器与交互。

## 迁移现有对话框

迁移时只需保留业务内容和按钮样式，删除原对话框重复的遮罩、滚动锁、焦点监听及布局样式。面板不要添加 `transform`：`SelectMenu` / `MultiSelectMenu` 的固定定位依赖视口坐标。
