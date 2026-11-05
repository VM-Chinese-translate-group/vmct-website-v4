# 进站公告维护

## 内容与标题

进站公告是独立的静态内容，维护在 `src/content/announcements/official-account.md`。窗口标题读取 YAML 元数据 `title`。

公告是仓库维护的可信内容，不接收用户提交。修改公告后需重新构建发布，关闭记忆与显示条件不变。

## 编译与排版

`unplugin-vue-markdown` 在构建时将公告编译为 Vue 组件，开启 `markdownOptions.html` 以支持 `<p align="right">`、`<center>` 等 HTML 排版；浏览器不额外加载 Markdown 解析器。

Markdown 组件化编译仅匹配 `src/content/announcements/` 目录（含子目录）下的 `.md`，Vue 插件与 Markdown 插件使用同一匹配规则；其他目录的 Markdown 不参与此编译链路，普通 `.vue` 文件不受影响。

## 来源按钮

公告来源按钮放在窗口底部，与“我知道了”并排。通过公告 MD 顶部的 `sourceButton` 配置文案、链接和显隐：

```yaml
sourceButton:
  enabled: true
  text: 查看 Bilibili 原公告
  link: https://www.bilibili.com/opus/1251946408080048130
```

`enabled` 省略时默认显示；设为 `false` 或删除整个 `sourceButton` 配置即可隐藏。查看来源会在新窗口打开配置链接，不关闭公告或记录已读；“我知道了”和关闭按钮继续保留原有关闭记忆。正文中不再重复显示来源链接。
