# D1 内容管理

内容保存在 D1；管理员访问 `/admin` 使用至少 6 位的数字、字母或符号密码登录。登录采用一次性挑战响应：PBKDF2 只在浏览器执行，Cloudflare Function 仅校验 HMAC，原始密码不会进入请求正文。发布内容时，后台从 D1 读取你保存的 Pages Deploy Hook URL，并触发一次完整构建。

## 只需配置三步

1. 创建 D1 数据库，例如 `vmct-site-content`，在 SQL Editor 中执行 [content-cms.sql](../database/content-cms.sql)。
2. 在现有 Pages 项目的 **Settings → Bindings** 添加 D1：

   ```text
   Variable name: CONTENT_DB
   Database: vmct-site-content
   ```

   保存后重新部署一次。

3. 打开 `https://vmct-cn.top/admin`，首次设置一个至少 6 位、可包含数字、字母或符号的密码。登录后进入“高级设置”，粘贴在 Pages 项目 **Settings → Builds → Deploy Hooks** 创建的 Production Hook URL 并保存。

## 修改后台密码

登录 `/admin` 后进入“高级设置”，在安全设置中输入两次新密码并提交。要改成指定密码，请在这里输入 `vmct220831`。修改成功后全部后台会话立即失效，需要用新密码重新登录。

密码派生的 100 次 PBKDF2 全部在浏览器完成，不占用 Cloudflare Function CPU；服务端每次登录只执行一次 HMAC。若需由 Cloudflare 加密变量集中管理，请预先离线派生 verifier，再分别配置 `CMS_ADMIN_VERIFIER` 和对应的 `CMS_ADMIN_SALT`，不要把原始密码或 verifier 提交到仓库。

> 即使密码不再以明文进入请求体，普通网页也无法彻底抵御可篡改 HTML/JavaScript、读取会话 Cookie 的恶意 Root CA。此协议可防止被动抓包泄露密码和重放 proof；完整防护仍需从设备信任库移除恶意 CA，或使用独立受信任客户端/硬件凭据。

此后，保存草稿只写 D1；点击“发布并完整构建”才会触发一次 Pages 完整构建。

## 数据库升级

新版后台会为 `content_pages` 增加 `draft_version`，用于防止多个浏览器标签页互相覆盖草稿。新数据库直接执行最新的 [content-cms.sql](../database/content-cms.sql) 即可；已有数据库在新版 Function 首次访问时会兼容性补充该列，不需要清空或重新导入内容。

## 后台编辑工作流

- 内容库保留简洁的路径搜索，并按文档、整合包和地图分组折叠展示。
- 新建文档、整合包或地图时会自动填入对应正文结构；复制页面只复制当前草稿，不继承发布状态。
- 页面路径、标题和正文达到最低条件后，停止输入约 1.2 秒会自动保存到 D1。`Ctrl+S` 或 `Cmd+S` 可以立即保存。
- 自动保存只更新草稿，不会发布内容或触发构建。发布和下线始终需要明确确认。
- 如果其他标签页先保存了同一页面，后台会显示版本冲突。选择服务器版本会放弃当前标签页修改；选择覆盖前应先确认当前内容确实是要保留的版本。
- 发布前检查会阻止非法路径、空标题、空正文、无效链接、错误布局和模板示例下载地址；缺少封面、简介、作者或版本等信息只会给出提醒。

## 发布历史与恢复

每次发布都会写入 `content_revisions`。在编辑页点击“历史”可以查看发布说明、Frontmatter、Markdown 和相对当前草稿的变化摘要。恢复历史版本只会将其复制为当前草稿，仍需再次点击发布才会更新网站。

如果内容已经发布或下线，但 Deploy Hook 调用失败，可以在后台设置中单独点击“测试构建”重试。重试构建不会修改草稿和历史版本。

## 导入现有 Markdown

完成上述三步后，在本地运行：

```powershell
pnpm content:migrate
```

脚本会在终端要求输入后台密码，随后导入 `src/pages/**/*.md` 并触发完整构建。确认线上页面正常后，再删除旧 Markdown。

## 从 D1 还原 Markdown

在任意需要恢复页面的本地副本中运行：

```bash
pnpm content:export
```

输入后台密码后，所有页面（草稿及已发布版本优先恢复草稿）会写入未纳入 Git 的 `content-export/` 目录。已有目录不会被覆盖；可通过 `pnpm content:export -- --output my-backup` 指定新的输出目录。
