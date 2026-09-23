#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/vmct-website}"
DATA_DIR="${VMCT_DATA_DIR:-/var/lib/vmct-website/data}"
ENV_FILE="/etc/vmct-website/api.env"
NGINX_CONF_DIR="/home/vmct/nginx/conf.d"

if [[ "${EUID}" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

if ! command -v git >/dev/null 2>&1; then
  echo '缺少 git，请先安装 git。' >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo '缺少 Node.js 22.6+。请先安装 Node.js，再重新运行此脚本。' >&2
  exit 1
fi

node_major="$(node -p 'process.versions.node.split(".")[0]')"
node_minor="$(node -p 'process.versions.node.split(".")[1]')"
node_version="$(node -p 'process.versions.node')"
if (( node_major < 22 || (node_major == 22 && node_minor < 6) )); then
  echo "Node.js ${node_version} 太旧，需要 22.6+。" >&2
  exit 1
fi

if [[ ! -d "${APP_DIR}/.git" ]]; then
  ${SUDO} mkdir -p "$(dirname "${APP_DIR}")"
  ${SUDO} git clone --branch cn-mainland --single-branch https://github.com/VM-Chinese-translate-group/vmct-website-v4.git "${APP_DIR}"
  ${SUDO} chown -R vmct:vmct "${APP_DIR}"
else
  git -C "${APP_DIR}" fetch origin cn-mainland
  git -C "${APP_DIR}" checkout cn-mainland
  git -C "${APP_DIR}" reset --hard origin/cn-mainland
fi

cd "${APP_DIR}"
PNPM_CMD=()
if command -v pnpm >/dev/null 2>&1 && pnpm --version >/dev/null 2>&1; then
  PNPM_CMD=(pnpm)
elif command -v npm >/dev/null 2>&1; then
  # A stale Corepack launcher can exist while its cached pnpm files are gone.
  # Use npm's isolated runner in that case; it does not depend on Corepack.
  PNPM_CMD=(npx --yes pnpm@12.5.1)
elif command -v curl >/dev/null 2>&1; then
  # Minimal ECS images may ship neither npm nor a package manager. Use the
  # official standalone installer, pinned to the project's pnpm version.
  PNPM_HOME="${PNPM_HOME:-${HOME}/.local/share/pnpm}"
  export PNPM_HOME
  mkdir -p "${PNPM_HOME}"
  curl -fsSL https://get.pnpm.io/install.sh \
    | env PNPM_HOME="${PNPM_HOME}" PNPM_VERSION=12.5.1 SHELL="${SHELL:-/bin/bash}" sh -
  export PATH="${PNPM_HOME}:${PATH}"
  if [[ ! -x "${PNPM_HOME}/pnpm" ]]; then
    echo 'pnpm 官方安装器未生成可执行文件。' >&2
    exit 1
  fi
  PNPM_CMD=("${PNPM_HOME}/pnpm")
elif command -v apt-get >/dev/null 2>&1; then
  # Some Debian/Ubuntu Node packages ship Corepack without npm. Install npm so
  # npx can fetch pnpm without using the broken Corepack cache.
  ${SUDO} apt-get update
  ${SUDO} apt-get install -y npm
  if ! command -v npx >/dev/null 2>&1; then
    echo 'npm 安装完成但找不到 npx，无法安装 pnpm。' >&2
    exit 1
  fi
  PNPM_CMD=(npx --yes pnpm@12.5.1)
elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1 || command -v apk >/dev/null 2>&1; then
  # Alibaba Linux and Alpine do not necessarily provide apt-get.
  if command -v dnf >/dev/null 2>&1; then
    ${SUDO} dnf install -y npm
  elif command -v yum >/dev/null 2>&1; then
    ${SUDO} yum install -y npm
  else
    ${SUDO} apk add --no-cache npm
  fi
  if ! command -v npx >/dev/null 2>&1; then
    echo 'npm 安装完成但找不到 npx，无法安装 pnpm。' >&2
    exit 1
  fi
  PNPM_CMD=(npx --yes pnpm@12.5.1)
else
  echo '缺少可用的 pnpm、npm、curl 或系统包管理器，无法安装依赖。' >&2
  exit 1
fi
"${PNPM_CMD[@]}" install --frozen-lockfile
node scripts/build-api.mjs

${SUDO} mkdir -p "${DATA_DIR}" /etc/vmct-website "${NGINX_CONF_DIR}"
${SUDO} chown -R vmct:vmct "$(dirname "${DATA_DIR}")"
if [[ -n "${DICT_DB_FILE:-}" ]]; then
  if [[ ! -f "${DICT_DB_FILE}" ]]; then
    echo "找不到预构建字典数据库：${DICT_DB_FILE}" >&2
    exit 1
  fi
  ${SUDO} install -m 0644 "${DICT_DB_FILE}" "${DATA_DIR}/dictionary.sqlite"
  ${SUDO} chown vmct:vmct "${DATA_DIR}/dictionary.sqlite"
  ${SUDO} rm -f "${DATA_DIR}/dictionary.sqlite-wal" "${DATA_DIR}/dictionary.sqlite-shm"
fi
if [[ ! -f "${ENV_FILE}" ]]; then
  ${SUDO} cp server/.env.example "${ENV_FILE}"
  ${SUDO} sed -i "s#^VMCT_DATA_DIR=.*#VMCT_DATA_DIR=${DATA_DIR}#; s#^DICT_DB_PATH=.*#DICT_DB_PATH=${DATA_DIR}/dictionary.sqlite#; s#^HOST=.*#HOST=0.0.0.0#" "${ENV_FILE}"
  ${SUDO} chmod 600 "${ENV_FILE}"
  echo "已创建 ${ENV_FILE}。请至少填入 ID_HASH_SECRET；如需赞助者名单，再填入 AFDIAN_*，然后再次运行此脚本。" >&2
  exit 2
fi

if [[ -n "${DICT_BACKUP:-}" && ! -f "${DATA_DIR}/dictionary.sqlite" ]]; then
  node --experimental-sqlite scripts/import-dictionary.mjs "${DICT_BACKUP}" "${DATA_DIR}/dictionary.sqlite"
fi

${SUDO} install -m 0644 server/vmct-website-api.service /etc/systemd/system/vmct-website-api.service
${SUDO} install -m 0644 server/nginx-www.vmct.top.conf "${NGINX_CONF_DIR}/www.vmct.top.conf"
${SUDO} systemctl daemon-reload
${SUDO} systemctl enable --now vmct-website-api
${SUDO} systemctl --no-pager --full status vmct-website-api

curl --fail --silent --show-error http://127.0.0.1:8787/api/content/admin/auth/status
echo

if command -v docker >/dev/null 2>&1 && ${SUDO} docker ps --format '{{.Names}}' | grep -qx nginx; then
  ${SUDO} docker exec nginx nginx -t
  ${SUDO} docker exec nginx nginx -s reload
  curl --fail --silent --show-error -H 'Host: www.vmct.top' http://127.0.0.1/api/content/admin/auth/status
  echo
fi

echo 'ECS API 与 www.vmct.top Nginx 回源部署完成。ESA Pages 请使用 cn-mainland 分支构建。'
