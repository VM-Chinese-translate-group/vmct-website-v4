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

首次运行创建 `/etc/vmct-website/api.env` 后会退出。填写至少一段随机的 `ID_HASH_SECRET`，然后再次运行脚本。

## Nginx 路由

- `/api/*` → `172.17.0.1:8787`。
- `/search` → `172.17.0.1:8787`。
- 其他请求 → 现有 Nginx 容器内的 `/home/vmct/vmct-website-dist`。

Nginx 使用 `try_files` 回退到 `index.html`，所以 Vue 路由可以直接访问。脚本不会修改 VMPM 的文件或数据库；静态文件保存在现有 Nginx 容器的独立目录中。

## DNS 和 HTTPS

将 `www.vmct.top` 的 A 记录直接指向 ECS 公网 IP，删除 ESA 的域名绑定和路由。安全组放行 TCP 80/443。若 ECS 已有 `/etc/letsencrypt` 证书，可在现有 Nginx 中为 `www.vmct.top` 添加 443 SSL server；证书路径与其他站点保持一致。

## 内容发布

发布内容后，ECS API 会调用本机 `SITE_REBUILD_HOOK_URL`，默认是：

```text
http://127.0.0.1:8787/internal/rebuild
```

该接口使用 `SITE_REBUILD_SECRET` 保护，并在后台启动一次静态站点构建。构建完成后静态 Nginx 会直接读取更新后的 `dist/`。
