# 单 ECS 部署

官网、CMS API、字典搜索和反馈接口全部运行在 ECS。Nginx 提供静态资产，Node 服务在 `8787` 承载动态 HTML 与原 API。内容发布无需构建。升级时先发布 VMPM 统一登录后端，再发布官网；具体配置、兼容路由、验证与回滚见 [动态官网说明](DYNAMIC_SITE.md)。

## 部署

要求 ECS Node.js 22.16 或更高版本，并且现有 Nginx Docker 容器已运行。首次部署：

```sh
curl -fsSL -o /tmp/vmct-deploy.sh \
  https://raw.githubusercontent.com/VM-Chinese-translate-group/vmct-website-v4/cn-mainland/server/deploy-ecs.sh
bash /tmp/vmct-deploy.sh
```

脚本会：

1. 拉取 `cn-mainland` 并安装依赖。
2. 准备现有 SQLite 或 PostgreSQL 数据库适配和 API 服务配置。
3. 构建浏览器资产、私有 SSR 组件与 API，然后启动 Node 服务。
4. 将 `dist/` 中的公开资产原子发布到 Nginx 挂载的 `/home/vmct/vmpm/dist/www.vmct.top`，不公开 SSR 目录。
5. 更新并重载现有 Nginx 的 `www.vmct.top` 配置。

预构建字典数据库可以直接复制，跳过 ECS 上的 SQL 导入：

```sh
DICT_DB_FILE=/home/vmct/vmweb/dictionary.sqlite bash /tmp/vmct-deploy.sh
```

首次运行创建 `/etc/vmct-website/api.env` 后会退出。填写随机的 `ID_HASH_SECRET`，确认 VMPM 的公网 origin 和私网 API 地址，再次运行脚本。先部署 VMPM 统一登录后端，避免官网更新后暂时无法进入管理页。

## Nginx 路由

- `/api/*` → `172.17.0.1:8787`。
- `/search` → `172.17.0.1:8787`。
- 哈希资产和图片 → `/home/vmct/vmpm/dist/www.vmct.top`。
- 首页、内容页、管理页、`/sitemap.xml` 和其他 HTML 路由 → `172.17.0.1:8787`。

Nginx 的内容路由回退到 Node SSR。缺失或下线的页面由服务端返回 404；`/server`、`/.vite` 等私有构建路径禁止公开。原 VMPM 公开下载 include 保留。

## DNS 和 HTTPS

将 `www.vmct.top` 的 A 记录直接指向 ECS 公网 IP，删除 ESA 的域名绑定和路由。安全组放行 TCP 80/443。`*.vmct.top` 通配符证书可以直接用于 `www.vmct.top`；若证书不在默认路径，执行部署时传入 `TLS_CERT_FILE` 和 `TLS_KEY_FILE`。

## 内容发布

发布内容后直接使运行时数据与 HTML 缓存失效，不再调用重建钩子。原本机地址保留为兼容的缓存刷新入口：

```text
http://127.0.0.1:8787/internal/rebuild
```

该接口仍由 `SITE_REBUILD_SECRET` 保护，仅刷新缓存。代码升级使用 `deploy-ecs.sh`；内容编辑与发布不会构建代码或替换静态资产。

旧 `deployment_hook_url` 设置可保留用于回滚，动态发布不会执行它。兼容刷新入口只在本机调用，不需要暴露到公网。

## 仓库自动更新

部署脚本同时安装 `vmct-website-update.timer`。它每 5 分钟检查 GitHub 的 `cn-mainland` 分支；检测到新提交后才运行完整的 `server/deploy-ecs.sh`，完成拉取、依赖安装、API 重启、前端构建和 Nginx 原子切换。更新器使用文件锁，避免手动部署和定时部署并发执行。

查看定时器状态：

```sh
sudo systemctl status vmct-website-update.timer
sudo systemctl list-timers vmct-website-update.timer
```

手动触发一次检查：

```sh
sudo systemctl start vmct-website-update.service
```

如果 ECS 访问 GitHub 需要本机代理，可创建 `/etc/vmct-website/update.env`，例如：

```sh
sudo install -m 600 /dev/null /etc/vmct-website/update.env
sudo sh -c 'printf "HTTPS_PROXY=http://127.0.0.1:7890\\nHTTP_PROXY=http://127.0.0.1:7890\\nNO_PROXY=127.0.0.1,localhost\\n" > /etc/vmct-website/update.env'
sudo systemctl restart vmct-website-update.timer
```

代理文件由更新服务读取，不会写入仓库。

## 词典自动更新

部署脚本安装 `vmct-dictionary-update.timer`，使用 [i18n-Dict-Extender Release](https://github.com/VM-Chinese-translate-group/i18n-Dict-Extender/releases) 中的 `Dict-Sqlite.db`。上游 [工作流](https://github.com/VM-Chinese-translate-group/i18n-Dict-Extender/blob/main/.github/workflows/update_and_release.yml) 每周五 UTC 10:00 运行；服务器定时器在一小时后，即每周五 UTC 11:00（北京时间 19:00）更新。服务器停机错过执行时间时，会在启动后补跑。如果上游尚未发布当周数据或更新失败，服务每小时重试。

更新器校验下载大小、上游提供的 SHA-256、SQLite 完整性和数据库字段，补建 API 使用的 `dict_fts` 索引。下载和索引构建期间继续提供旧词典；只在切换文件时短暂停止 API。启动后检查不同 `v` 参数的搜索结果，失败时恢复旧数据库。成功后保留上一版 `dictionary.sqlite.previous`，将 Release 信息记录到数据目录的 `dictionary-release.json`。已安装的同一数据版本会跳过下载和重启。

GitHub Release 下载支持断点续传，未完成的文件保存在数据目录的 `.dictionary-download/<assetId>.sqlite`，成功后删除。单次下载允许最多 3 小时，服务最多运行 4 小时，以适应 ECS 到 GitHub 的慢速连接。下载和建索引不占用网站部署锁；只在复制更新工具和切换数据库时持有锁。

更新器读取 `/etc/vmct-website/api.env` 的 `VMCT_DATA_DIR`、`DICT_DB_PATH`，并复用 `/etc/vmct-website/update.env` 的代理配置。它与网站部署共用锁，避免同时重启 API。上游修改定时时，需同步修改 `server/vmct-dictionary-update.timer` 和 `scripts/dictionary-update.mjs` 的发布时间检查。

```sh
sudo systemctl list-timers vmct-dictionary-update.timer
sudo journalctl -u vmct-dictionary-update.service -n 80 --no-pager
# 首次安装后也可立即获取最新词典：
sudo systemctl start vmct-dictionary-update.service
```

需要手动触发时，在 ECS 本机执行：

```sh
SECRET="$(sudo awk -F= '$1 == "SITE_REBUILD_SECRET" { print substr($0, index($0, "=") + 1) }' /etc/vmct-website/api.env)"
curl -i -X POST http://127.0.0.1:8787/internal/rebuild \
  -H "Authorization: Bearer ${SECRET}"
```
