# D1 内容管理

内容保存在 D1；管理员访问 `/admin` 使用至少 6 位的数字、字母或符号密码登录。发布内容时，后台从 D1 读取你保存的 Pages Deploy Hook URL，并触发一次完整构建。

## 只需配置三步

1. 创建 D1 数据库，例如 `vmct-site-content`，在 SQL Editor 中执行 [content-cms.sql](../database/content-cms.sql)。
2. 在现有 Pages 项目的 **Settings → Bindings** 添加 D1：

   ```text
   Variable name: CONTENT_DB
   Database: vmct-site-content
   ```

   保存后重新部署一次。

3. 打开 `https://vmct-cn.top/admin`，首次设置一个至少 6 位、可包含数字、字母或符号的密码。登录后展开“部署设置”，粘贴在 Pages 项目 **Settings → Builds → Deploy Hooks** 创建的 Production Hook URL 并保存。

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
