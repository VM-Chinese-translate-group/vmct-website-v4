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
