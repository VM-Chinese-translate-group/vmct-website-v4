# 动态官网与 VMPM 内容管理

## 运行方式

官网在运行时从现有 SQLite 或 PostgreSQL 内容数据库读取已发布版本。同类正文共用 `src/content/ContentPage.vue` 和 `ContentDocument.ts`，按 URL 选择资源或文档布局，新建内容不生成 Vue 文件。

首页推荐、资源列表、搜索、SEO 元信息和 `/sitemap.xml` 都来自同一份已发布内容。保存草稿不影响公开版本；发布、批量发布、改路径和下线会使内容和 HTML 缓存失效。发布完成后开始的新请求读取新版；已打开的页面刷新或站内切换后更新。下线和改路径后的旧地址返回 HTTP 404。

`pnpm build` 仅在更新代码时运行，产物包含浏览器资产 `dist/`、私有服务端组件 `dist/server/` 和 `server/generated/content-api.mjs`。发布内容不调用 Vite、预渲染、Docker 或 Nginx 重载。Nginx 继续提供静态资产，将 HTML 请求交给原 Node 服务 8787。

只有 CMS 从未发布过内容时，运行时才读取仓库 Markdown 作为首次启动回退，保存草稿不会撤掉这些公开页面；有发布历史后以数据库为准，所有页面下线不会恢复旧仓库内容。首次启用 CMS 应先导入完整内容。原页面 ID、发布历史和下载配置保持有效。

进站公告是独立的静态内容，维护在 `src/content/announcements/official-account.md`。`unplugin-vue-markdown` 在构建时将其编译为 Vue 组件，开启 `markdownOptions.html` 以支持 `<p align="right">`、`<center>` 等 HTML 排版；窗口标题读取 YAML 元数据 `title`。公告是仓库维护的可信内容，不接收用户提交；浏览器不额外加载 Markdown 解析器。修改公告后需重新构建发布，关闭记忆与显示条件不变。

## 原路由

- 页面 URL、目录 `index.md` 对应的短地址及所有原业务 API 路由继续使用。
- `GET /api/content/internal/export` 保留 `{pages:[{path,frontmatter,body}]}`。增加可选查询 `view=site&path=/页面地址`，返回页面目录和当前正文，旧调用方无需修改。
- 原管理发布响应保留 `deployment.requested`，附加 `mode: "dynamic"`。原 `/api/content/admin/deploy` 和受保护的 `/internal/rebuild` 改为刷新缓存。
- `/api/translation-feedback/*`、`/api/bilibili*`、`/api/afdian*`、`/api/dict/search` 与 `/search` 沿用原分发。
- 下载的独立 Nginx include 保留，`/downloads`、`/files`、`/download-catalog` 仍由 VMPM 提供。下载控件继续使用 `/api/content/downloads` 和 `/download-catalog/lazy`。

## 内嵌与统一登录

VMPM `/website-content` 受原管理员角色保护，内嵌官网 `/admin?embedded=1`，隐藏官网导航、页脚和反馈挂件。编辑器、自动保存、历史和发布仍为原 Vue 页面。独立 `/admin` 未登录时提供 VMPM 入口。

1. iframe 发起带随机 nonce 的握手，父页面校验官网 origin 和窗口。
2. VMPM 前端通过自身 JWT 请求 `POST /api/auth/content-sso/ticket`。服务端校验当前管理员角色和 QQ 绑定。
3. 60 秒有效、256 位随机的一次性票据通过指定 origin 的 `postMessage` 传入 iframe。JWT 不进入 iframe、URL 或日志。
4. iframe 使用原 `POST /api/content/admin/auth/login`，正文 `{ticket}`。官网服务端通过私网 `POST /api/auth/content-sso/redeem` 换取专用 grant，建立 HttpOnly、Secure、SameSite=Strict 的官网会话。
5. 每次管理请求都通过 VMPM `/api/auth/content-sso/session` 检查 grant、JWT 有效期、用户当前角色和 QQ 绑定。VMPM 退出、权限撤销和 JWT 过期均阻断后续管理操作；身份服务暂不可用时返回 503，不降级到旧密码。
6. 原 VMPM `/api/auth/logout` 的新增 filter 撤销该登录签发的票据与 grant；iframe 的退出按钮也通知 VMPM 退出。

票据和 grant 位于 VMPM 进程内；重启后从“官网内容”重新进入即可建立新会话。官网自动创建 `cms_external_sessions` 关联会话和 grant，清理会话时级联清理；该表属于私有会话数据。

## 本地验证

`pnpm dev` 在一个进程中启动 Vite 中间件、SSR 和 API，默认 `127.0.0.1:5173`。`pnpm build` 后可用 `pnpm start` 验证生产产物。生产默认统一登录 origin 为 `https://vmpm.vmct.top`，私网 VMPM API 为 `http://127.0.0.1:8080`。

本地联调分别配置官网 `VMPM_SSO_ORIGIN=http://localhost:3000`、`VMPM_API_ORIGIN=http://localhost:8080` 和 VMPM 前端 `VITE_WEBSITE_ORIGIN=http://localhost:5173`。两端使用相同 hostname 和 scheme，仅端口不同。开发模式未配置 SSO 时保留旧开发登录。

```sh
pnpm build
pnpm type-check
pnpm test:site
```

VMPM `ContentSsoServiceTest` 覆盖一次兑换、并发重放、票据过期、角色和 QQ 绑定变化、JWT 失效及原退出路由撤销。

原 `content:migrate` 与 `content:export` CLI 也支持统一登录：通过 `VMPM_TOKEN` 环境变量提供当前管理员会话，必要时以 `VMPM_ORIGIN` 指定身份服务来源。CLI 将 JWT 仅发给 VMPM，向官网只传一次性票据，不将令牌放入参数或日志。未启用统一登录的开发环境保留密码提示。

浏览器协议 fixture：先将 VMPM 前端以 `VITE_WEBSITE_ORIGIN=http://localhost:39430` 构建到单独目录，再运行 `node server/test-support/browser-fixture.mjs <该目录的绝对路径>`，入口为 `http://localhost:39432/__fixture/login`。它使用临时数据库和模拟身份接口，不连接业务数据库、机器人或真实登录服务；Java 身份逻辑由 VMPM 测试覆盖。

## 部署与回滚

发布时按以下顺序：

低配服务器推荐在开发机设置 `BRANCH=cn-mainland` 后运行 `pnpm build:package`，上传生成的 `dist-package/site.tar.gz`。部署时提供 `SITE_BUILD_ARCHIVE` 的服务器绝对路径和打包命令输出的 `SITE_BUILD_SHA256`。脚本核对归档校验和、提交号及关键文件，安装运行依赖并切换产物，不在服务器运行 Vite 或 TypeScript。未提供预构建归档时保留原代码构建方式。官网默认就绪等待为 600 秒，可用 `SITE_READY_TIMEOUT_SECONDS` 调整。

1. 备份内容数据库、官网产物、VMPM 后端/前端和现有配置。
   暂停 `vmct-website-update.timer` 并等待已运行的更新结束；手动发布和自动更新共用 `/opt/vmct-website/.vmct-deploy.lock`，不要并行执行另一套构建或重置仓库。
2. 先升级 VMPM 后端并验证新 SSO 接口，再发布包含“官网内容”入口的 VMPM 前端。
3. 确认官网环境配置 `VMPM_SSO_ORIGIN=https://vmpm.vmct.top` 和 `VMPM_API_ORIGIN=http://127.0.0.1:8080`；私网地址按实际服务调整。
4. 用原 `server/deploy-ecs.sh` 完成代码构建、SSR/API 服务更新及静态资产发布。私有 `/server`、`/.vite` 等路径禁止公开。
   构建写入 `.site-releases/<版本>/`，成功后切换 `dist` 链接；旧 SSR 版本不在构建时清空。新静态版本保留上一版哈希资产。仅健康检查通过后记录 `/var/lib/vmct-website/deployed-revision`，再恢复更新定时器。
5. 回归首页、资源、社区、sitemap、真实管理员登录、内容即时发布、普通成员拒绝访问和两边退出。

回滚时同时恢复匹配版本的官网 Node 代码、SSR 产物、浏览器资产和 Nginx 配置；保留内容数据库及下载配置，不重新导入旧 Markdown。新增会话表兼容旧版，无需删除。VMPM 同时恢复匹配的后端和前端。恢复静态官网后按旧流程构建；避免混用新旧 Node 服务和浏览器资产。
