<div align="center">
  <img src="public/imgs/logo/logo_256.png" alt="VM汉化组" width="128" height="128" />
</div>

# VM汉化组官网 v4

立即访问：<https://www.vmct.top/>

## 📖 使用与部署

官网采用运行时动态渲染，内容发布无需构建；Vue 内容后台在 VMPM 内嵌并统一登录。架构、联调与部署顺序见 [动态官网说明](DYNAMIC_SITE.md)。

我们推荐使用 VSCode 编辑器进行开发。

在开发前，请先安装 [NodeJS](https://nodejs.org/zh-cn/download/prebuilt-installer)，推荐安装 Node24。

安装依赖：

```sh
pnpm i
```

开发预览：

```sh
pnpm run dev
```

构建：

```sh
pnpm run build
```

## 弹窗

进站公告、下载资源选择，以及下载流程中的网盘选择、协议确认、答题和结果提示统一使用 `src/components/BaseDialog.vue`。该组件管理焦点圈定与恢复、Escape/遮罩关闭、背景隔离和页面滚动锁，业务组件通过 `open`、`update:open` 和插槽控制内容，不再依赖 SweetAlert2。

底部操作区使用 `.base-dialog-actions`：按钮采用居中等宽横排，间距为 8px，单个按钮宽度上限为 160px；窄屏按可用空间等比例收缩，单按钮同样居中。底栏沿用原有 `var(--bg-soft)` 背景，并以分隔线与正文区分。公共样式统一固定高度 44px 和文本居中，配色、圆角、字号与水平内边距沿用各业务原有按钮外观。下载选择题的 A/B/C/D 保留蓝色选项按钮并放入底栏；输入题仅将提交按钮放入底栏。错误提示等非按钮内容放在该操作区外，保留在 footer 插槽中。

下载界面位于 `src/components/DownloadPage/DownloadActionDialog.vue`，状态与跳转逻辑位于 `useDownloadModal.ts`。协议确认保留三秒倒计时；答错后重新抽题，题库轮完前不重复；关闭或卸载后不再显示尚未加载完成的题目。公告保留原有简体中文触发条件与本地关闭记忆。
