# 单 ECS 部署

官网、CMS API、字典搜索和反馈接口全部运行在 ECS 上。现有 Docker Nginx 负责 `www.vmct.top`，并直接托管构建后的 `dist/`，Node 服务监听 `8787` 提供动态接口。ESA 不参与访问链路。

## 部署

要求 ECS Node.js 22.6 或更高版本，并且现有 Nginx Docker 容器已运行。首次部署：

```sh
curl -fsSL -o /tmp/vmct-deploy.sh \
  https://raw.githubusercontent.com/VM-Chinese-translate-group/vmct-website-v4/cn-mainland/server/deploy-ecs.sh
bash /tmp/vmct-deploy.sh
```

脚本会：

1. 拉取 `cn-mainland` 并安装依赖。
2. 启动 ECS API 服务和独立 SQLite 数据库。
3. 构建前端静态文件到 `/opt/vmct-website/dist`。
4. 将 `dist/` 原子复制到现有 Nginx 容器的 `/home/vmct/vmct-website-dist`。
5. 更新并重载现有 Nginx 的 `www.vmct.top` 配置。

预构建字典数据库可以直接复制，跳过 ECS 上的 SQL 导入：

```sh
DICT_DB_FILE=/home/vmct/vmweb/dictionary.sqlite bash /tmp/vmct-deploy.sh
```

首次运行创建 `/etc/vmct-website/api.env` 后会退出。填写至少一段随机的 `ID_HASH_SECRET`，然后再次运行脚本。脚本会让 API 服务使用 `docker` 用户组，以便内容发布后通过现有 Nginx 容器完成静态文件替换。

## Nginx 路由

- `/api/*` → `172.17.0.1:8787`。
- `/search` → `172.17.0.1:8787`。
- 其他请求 → 现有 Nginx 容器内的 `/home/vmct/vmct-website-dist`。

Nginx 使用 `try_files` 回退到 `index.html`，所以 Vue 路由可以直接访问。脚本不会修改 VMPM 的文件或数据库；静态文件保存在现有 Nginx 容器的独立目录中。

## DNS 和 HTTPS

将 `www.vmct.top` 的 A 记录直接指向 ECS 公网 IP，删除 ESA 的域名绑定和路由。安全组放行 TCP 80/443。`*.vmct.top` 通配符证书可以直接用于 `www.vmct.top`；若证书不在默认路径，执行部署时传入 `TLS_CERT_FILE` 和 `TLS_KEY_FILE`。

## 内容发布

发布内容后，ECS API 会调用本机 `SITE_REBUILD_HOOK_URL`，默认是：

```text
http://127.0.0.1:8787/internal/rebuild
```

该接口使用 `SITE_REBUILD_SECRET` 保护，并在后台启动一次静态站点构建。构建完成后，API 会把新 `dist/` 原子复制到现有 Nginx 容器并重载 Nginx，因此 CMS 发布后不需要重新执行完整部署脚本。完整代码升级仍使用 `deploy-ecs.sh`。

部署脚本会把内容数据库中的 `deployment_hook_url` 自动改为上述 ECS 地址，覆盖旧的 Cloudflare Pages deploy hook。该地址只在 ECS 本机调用，不需要暴露到公网。

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
sudo sh -c 'printf "HTTPS_PROXY=http://127.0.0.1:7890\\nHTTP_PROXY=http://127.0.0.1:7890\\n" > /etc/vmct-website/update.env'
sudo systemctl restart vmct-website-update.timer
```

代理文件由更新服务读取，不会写入仓库。

需要手动触发时，在 ECS 本机执行：

```sh
SECRET="$(sudo awk -F= '$1 == "SITE_REBUILD_SECRET" { print substr($0, index($0, "=") + 1) }' /etc/vmct-website/api.env)"
curl -i -X POST http://127.0.0.1:8787/internal/rebuild \
  -H "Authorization: Bearer ${SECRET}"
```
