# ESA + ECS 部署

官网静态资源由 ESA Pages 构建并发布，动态接口运行在 ECS 的独立 Node 服务中。ECS 服务使用独立 SQLite 文件，不连接其他项目的 PostgreSQL 或 Redis。

## ECS 初始化

要求 Node.js 22.6 或更高版本（需要支持 `node:sqlite`）。将仓库部署到 `/opt/vmct-website`，安装依赖后准备数据目录：

```sh
sudo mkdir -p /opt/vmct-website /var/lib/vmct-website/data /etc/vmct-website
sudo chown -R vmct:vmct /opt/vmct-website /var/lib/vmct-website
cd /opt/vmct-website
pnpm install --frozen-lockfile
```

首次部署可以直接运行 `server/deploy-ecs.sh`。脚本会拉取 `cn-mainland`、安装依赖、创建独立数据目录、安装 systemd 服务和 Nginx 配置。第一次运行会创建 `/etc/vmct-website/api.env` 并退出，填好环境变量后再次运行即可。

复制 `server/.env.example` 到 `/etc/vmct-website/api.env`，填入随机的 `ID_HASH_SECRET`、后台密码 verifier，以及爱发电的 `AFDIAN_USER_ID` 和 `AFDIAN_TOKEN`。凭据只写入 ECS 环境文件，不写进仓库。

启用服务：

```sh
sudo cp server/vmct-website-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vmct-website-api
```

首次安装 CMS 表会自动执行 `database/content-cms.sql` 和 `database/translation-feedback.sql`。字典数据库需要把 Cloudflare D1 导出的 SQL 导入 `/var/lib/vmct-website/data/dictionary.sqlite`，例如：

```sh
node --experimental-sqlite scripts/import-dictionary.mjs /path/to/d1backup.sql
```

## Nginx 与 ESA

把 `server/nginx-www.vmct.top.conf` 挂载到现有 Nginx 容器的 `conf.d`，然后检查并重载 Nginx。该配置只处理 `www.vmct.top` 的 `/api/*` 和 `/search`，不会覆盖其他站点。

配置默认使用 Docker bridge 宿主网关 `172.17.0.1:8787`。如果 ECS 的 Docker bridge 网关不同，先用 `ip route` 查看网关，再同步修改 Nginx 配置中的地址。

ESA Pages 导入仓库后将生产分支设为 `cn-mainland`，构建配置使用仓库根目录的 `esa.jsonc`。ESA 回源规则把 `www.vmct.top/api/*` 和 `/search` 转发到 ECS；动态接口关闭缓存，静态文件使用 ESA Pages 的资源缓存。

`ESA_DEPLOY_HOOK_URL` 可以填 ESA 的构建触发地址。后台发布内容时会调用它；如果为空，也可以在后台设置页面填写触发地址。

## 内容迁移

把原 CMS 导出的 JSON 发送到 ECS：

```sh
pnpm run content:export
```

这条命令用于从当前服务导出；首次迁移时使用原 Cloudflare 导出的页面 JSON，调用 `/api/content/admin/import`，登录后将页面和历史记录导入 ECS SQLite。ESA 后续构建通过 `/api/content/internal/export` 读取已发布页面。
