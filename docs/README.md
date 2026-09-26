<div align="center">
  <img src="public/imgs/logo/logo_256.png" alt="VM汉化组" width="128" height="128" />
</div>

# VM汉化组官网 v4

站点地址由 `VITE_SITE_URL` 配置，详见下方环境变量说明。

## 📖 使用与部署

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

## 环境变量

仓库中的 `.env` 保存公开的默认配置。本地在 `.env.local` 覆盖，部署时在平台的构建环境变量中覆盖。修改后需要重新构建；客户端、SSR、SEO 和内容脚本共用配置。所有 `VITE_` 变量都是公开信息，不要填入密钥。

| 变量                  | 用途                                                             |
| --------------------- | ---------------------------------------------------------------- |
| `VITE_SITE_URL`       | 官网源地址，用于 SEO、canonical、站点地图和自动生成的 robots.txt |
| `VITE_API_BASE_URL`   | Bilibili、爱发电 API 的源地址，留空使用官网地址                  |
| `VITE_CONTENT_ORIGIN` | 内容同步、导入、导出及开发时 CMS 代理的源地址，留空使用官网地址  |
| `VITE_DOCS_URL`       | 文档站源地址                                                     |
| `VITE_DICT_URL`       | 词典站源地址                                                     |
| `VITE_CONTACT_EMAIL`  | 赞助页面的联系邮箱                                               |
| `VITE_ENABLE_BEIAN`   | 仅精确设置为 `true` 时启用备案；只在简体中文下显示，默认关闭     |

URL 配置仅接受 `http://` 或 `https://` 源地址，不包含路径、查询参数或账号密码；允许末尾 `/`。

`vmct.top` 的构建环境至少设置：

```dotenv
VITE_SITE_URL=https://vmct.top
VITE_ENABLE_BEIAN=true
```

API 和内容源默认随官网切换。若仍使用其他站点的服务，显式设置 `VITE_API_BASE_URL` 和 `VITE_CONTENT_ORIGIN`，并确保服务允许对应跨域请求。文档站、词典站和邮箱独立配置，不随官网域名自动变化。

内容脚本默认读取 production 模式的环境文件；`pnpm dev` 的内容同步读取 development 模式。手动同步可用 `pnpm content:pull --mode development`。构建时请使用同一组配置完成客户端与 SSR 构建。

本地开发通过 `.env.development` 将内容服务和通用 API 指向 `https://www.vmct.top`。Vite 代理 `/api/content` 到 `VITE_CONTENT_ORIGIN`，其余 `/api` 请求到 `VITE_API_BASE_URL`，覆盖后台、汉化征集、Bilibili 和爱发电。内容同步也使用同一内容来源。在本地后台保存、发布会直接操作线上内容。需要覆盖地址时，使用 `.env.development.local` 或进程环境变量。

API 源地址应填写最终服务地址，避免重定向。当前 `vmct.top` 会 301 跳转到 `www.vmct.top`，可能将登录 POST 变成 GET，并让浏览器请求离开本地代理。`VITE_FEEDBACK_API_BASE` 可单独覆盖汉化征集接口；本地开发通常保持未设置，使用默认 `/api/translation-feedback` 代理路径。
