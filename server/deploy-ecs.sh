#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/vmct-website}"
DATA_DIR="${VMCT_DATA_DIR:-/var/lib/vmct-website/data}"
ENV_FILE="/etc/vmct-website/api.env"
NGINX_CONF_DIR="/home/vmct/nginx/conf.d"
STATIC_ROOT="/home/vmct/vmpm/dist/www.vmct.top"
BRANCH="${DEPLOY_BRANCH:-cn-mainland}"
TLS_CERT_FILE="${TLS_CERT_FILE:-/etc/letsencrypt/live/vmct.top/fullchain.pem}"
TLS_KEY_FILE="${TLS_KEY_FILE:-/etc/letsencrypt/live/vmct.top/privkey.pem}"

if [[ "${EUID}" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

run_as_vmct() {
  if [[ "${EUID}" -eq 0 ]]; then
    runuser -u vmct -- "$@"
  else
    "$@"
  fi
}

if [[ -z "${DEPLOY_LOCK_FILE:-}" && -d "${APP_DIR}" ]]; then
  DEPLOY_LOCK_FILE="${APP_DIR}/.vmct-deploy.lock"
elif [[ -z "${DEPLOY_LOCK_FILE:-}" ]]; then
  # The first clone happens before APP_DIR exists, so use a temporary lock
  # only for that initial bootstrap.
  DEPLOY_LOCK_FILE="/tmp/vmct-website-deploy.lock"
fi
mkdir -p "$(dirname "${DEPLOY_LOCK_FILE}")"
# A coordinated release may already hold this exact descriptor while it
# upgrades VMPM and checks out this script. Reuse its lock without a gap.
if [[ "$(readlink "/proc/$$/fd/9" 2>/dev/null || true)" != "${DEPLOY_LOCK_FILE}" ]]; then
  exec 9>"${DEPLOY_LOCK_FILE}"
fi
if ! flock -n 9; then
  echo '已有 ECS 部署正在进行，跳过本次部署。'
  exit 0
fi

if ! command -v git >/dev/null 2>&1; then
  echo '缺少 git，请先安装 git。' >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo '缺少 Node.js 22.16+。请先安装 Node.js，再重新运行此脚本。' >&2
  exit 1
fi

node_major="$(node -p 'process.versions.node.split(".")[0]')"
node_minor="$(node -p 'process.versions.node.split(".")[1]')"
node_version="$(node -p 'process.versions.node')"
if (( node_major < 22 || (node_major == 22 && node_minor < 16) )); then
  echo "Node.js ${node_version} 太旧，需要 22.16+。" >&2
  exit 1
fi

if [[ ! -d "${APP_DIR}/.git" ]]; then
  ${SUDO} mkdir -p "$(dirname "${APP_DIR}")"
  ${SUDO} git clone --branch "${BRANCH}" --single-branch https://github.com/VM-Chinese-translate-group/vmct-website-v4.git "${APP_DIR}"
  ${SUDO} chown -R vmct:vmct "${APP_DIR}"
else
  if ! git -c "safe.directory=${APP_DIR}" -C "${APP_DIR}" diff --quiet HEAD -- server scripts; then
    echo '部署脚本有未提交修改；请先将修改合入部署分支，防止自动更新覆盖。' >&2
    exit 1
  fi
  git -c "safe.directory=${APP_DIR}" -C "${APP_DIR}" fetch origin "${BRANCH}"
  if [[ -n "${EXPECTED_DEPLOY_REVISION:-}" && "$(git -c "safe.directory=${APP_DIR}" -C "${APP_DIR}" rev-parse "origin/${BRANCH}")" != "${EXPECTED_DEPLOY_REVISION}" ]]; then
    echo '远端部署分支已变化，请重新核对发布版本后重试。' >&2
    exit 1
  fi
  git -c "safe.directory=${APP_DIR}" -C "${APP_DIR}" checkout "${BRANCH}"
  git -c "safe.directory=${APP_DIR}" -C "${APP_DIR}" reset --hard "origin/${BRANCH}"
fi

${SUDO} chown -R vmct:vmct "${APP_DIR}"
cd "${APP_DIR}"
PNPM_VERSION="${PNPM_VERSION:-$(node -p "(require('./package.json').packageManager || 'pnpm@12.5.1').replace(/^pnpm@/, '')")}"
PNPM_CMD=()
if [[ -x /home/vmct/.local/share/pnpm/bin/pnpm ]]; then
  PNPM_CMD=(/home/vmct/.local/share/pnpm/bin/pnpm)
elif command -v pnpm >/dev/null 2>&1 && pnpm --version >/dev/null 2>&1; then
  PNPM_CMD=(pnpm)
elif command -v npm >/dev/null 2>&1; then
  # A stale Corepack launcher can exist while its cached pnpm files are gone.
  # Use npm's isolated runner in that case; it does not depend on Corepack.
  PNPM_CMD=(npx --yes "pnpm@${PNPM_VERSION}")
elif command -v curl >/dev/null 2>&1; then
  # Minimal ECS images may ship neither npm nor a package manager. Use the
  # official standalone installer, pinned to the project's pnpm version.
  PNPM_HOME="${PNPM_HOME:-/home/vmct/.local/share/pnpm}"
  export PNPM_HOME
  run_as_vmct mkdir -p "${PNPM_HOME}"
  curl -fsSL https://get.pnpm.io/install.sh \
    | run_as_vmct env PNPM_HOME="${PNPM_HOME}" PNPM_VERSION="${PNPM_VERSION}" SHELL="${SHELL:-/bin/bash}" sh -
  export PATH="${PNPM_HOME}/bin:${PNPM_HOME}:${PATH}"
  PNPM_BIN="${PNPM_HOME}/bin/pnpm"
  if [[ ! -x "${PNPM_BIN}" && -x "${PNPM_HOME}/pnpm" ]]; then
    PNPM_BIN="${PNPM_HOME}/pnpm"
  fi
  if [[ ! -x "${PNPM_BIN}" ]]; then
    echo 'pnpm 官方安装器未生成可执行文件。' >&2
    exit 1
  fi
  PNPM_CMD=("${PNPM_BIN}")
elif command -v apt-get >/dev/null 2>&1; then
  # Some Debian/Ubuntu Node packages ship Corepack without npm. Install npm so
  # npx can fetch pnpm without using the broken Corepack cache.
  ${SUDO} apt-get update
  ${SUDO} apt-get install -y npm
  if ! command -v npx >/dev/null 2>&1; then
    echo 'npm 安装完成但找不到 npx，无法安装 pnpm。' >&2
    exit 1
  fi
  PNPM_CMD=(npx --yes "pnpm@${PNPM_VERSION}")
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
  PNPM_CMD=(npx --yes "pnpm@${PNPM_VERSION}")
else
  echo '缺少可用的 pnpm、npm、curl 或系统包管理器，无法安装依赖。' >&2
  exit 1
fi
run_as_vmct "${PNPM_CMD[@]}" install --frozen-lockfile
run_as_vmct node scripts/build-api.mjs

${SUDO} mkdir -p "${DATA_DIR}" /etc/vmct-website "${NGINX_CONF_DIR}"
${SUDO} chown -R vmct:vmct "$(dirname "${DATA_DIR}")"
# Read only the active backend from the API's private environment file.
# A first-time bootstrap without that file retains the SQLite default.
database_backend='sqlite'
if [[ -f "${ENV_FILE}" ]]; then
  database_backend="$(${SUDO} env -u VMCT_DATABASE_BACKEND -u VMCT_DATABASE_URL \
    node --env-file="${ENV_FILE}" scripts/ensure-ecs-settings.mjs --print-backend)"
fi
if [[ "${database_backend}" == 'sqlite' && -n "${DICT_DB_FILE:-}" ]]; then
  if [[ ! -f "${DICT_DB_FILE}" ]]; then
    echo "找不到预构建字典数据库：${DICT_DB_FILE}" >&2
    exit 1
  fi
  ${SUDO} install -m 0644 "${DICT_DB_FILE}" "${DATA_DIR}/dictionary.sqlite"
  ${SUDO} chown vmct:vmct "${DATA_DIR}/dictionary.sqlite"
  ${SUDO} rm -f "${DATA_DIR}/dictionary.sqlite-wal" "${DATA_DIR}/dictionary.sqlite-shm"
elif [[ "${database_backend}" == 'postgres' && -n "${DICT_DB_FILE:-}" ]]; then
  echo 'PostgreSQL 模式跳过 DICT_DB_FILE；字典由 PostgreSQL 更新流程维护。'
fi
if [[ ! -f "${ENV_FILE}" ]]; then
  ${SUDO} cp server/.env.example "${ENV_FILE}"
  rebuild_secret="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
  ${SUDO} sed -i "s#^VMCT_DATA_DIR=.*#VMCT_DATA_DIR=${DATA_DIR}#; s#^DICT_DB_PATH=.*#DICT_DB_PATH=${DATA_DIR}/dictionary.sqlite#; s#^HOST=.*#HOST=0.0.0.0#; s#^SITE_REBUILD_HOOK_URL=.*#SITE_REBUILD_HOOK_URL=http://127.0.0.1:8787/internal/rebuild#; s#^SITE_REBUILD_SECRET=.*#SITE_REBUILD_SECRET=${rebuild_secret}#" "${ENV_FILE}"
  ${SUDO} chmod 600 "${ENV_FILE}"
  echo "已创建 ${ENV_FILE}。请至少填入 ID_HASH_SECRET；如需赞助者名单，再填入 AFDIAN_*，然后再次运行此脚本。" >&2
  exit 2
fi

# Upgrade an environment file created by an earlier ESA-based deployment.
if ! ${SUDO} grep -q '^SITE_REBUILD_HOOK_URL=' "${ENV_FILE}"; then
  ${SUDO} tee -a "${ENV_FILE}" >/dev/null <<'EOF'
SITE_REBUILD_HOOK_URL=http://127.0.0.1:8787/internal/rebuild
EOF
else
  # The single-server layout always rebuilds locally. Replace a hook left by
  # an earlier ESA deployment so CMS publishing cannot call the old service.
  ${SUDO} sed -i 's#^SITE_REBUILD_HOOK_URL=.*#SITE_REBUILD_HOOK_URL=http://127.0.0.1:8787/internal/rebuild#' "${ENV_FILE}"
fi
if ! ${SUDO} grep -q '^SITE_REBUILD_SECRET=' "${ENV_FILE}"; then
  rebuild_secret="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
  ${SUDO} sh -c "printf 'SITE_REBUILD_SECRET=%s\\n' '${rebuild_secret}' >> '${ENV_FILE}'"
fi
if ! ${SUDO} grep -q '^NGINX_CONTAINER=' "${ENV_FILE}"; then
  ${SUDO} sh -c "printf 'NGINX_CONTAINER=nginx\\n' >> '${ENV_FILE}'"
fi
if ${SUDO} grep -q '^NGINX_STATIC_ROOT=' "${ENV_FILE}"; then
  ${SUDO} sed -i "s#^NGINX_STATIC_ROOT=.*#NGINX_STATIC_ROOT=${STATIC_ROOT}#" "${ENV_FILE}"
else
  ${SUDO} sh -c "printf 'NGINX_STATIC_ROOT=%s\\n' '${STATIC_ROOT}' >> '${ENV_FILE}'"
fi

# Bootstrap a legacy dictionary only while SQLite is the active backend.
if [[ "${database_backend}" == 'sqlite' && -n "${DICT_BACKUP:-}" && ! -f "${DATA_DIR}/dictionary.sqlite" ]]; then
  node --experimental-sqlite scripts/import-dictionary.mjs "${DICT_BACKUP}" "${DATA_DIR}/dictionary.sqlite"
elif [[ "${database_backend}" == 'postgres' && -n "${DICT_BACKUP:-}" ]]; then
  echo 'PostgreSQL 模式跳过 DICT_BACKUP；不修改保留的 SQLite 字典。'
fi

${SUDO} install -m 0644 server/vmct-website-api.service /etc/systemd/system/vmct-website-api.service
${SUDO} install -m 0755 server/update-ecs.sh /usr/local/sbin/vmct-website-update
${SUDO} install -m 0644 server/vmct-website-update.service /etc/systemd/system/vmct-website-update.service
${SUDO} install -m 0644 server/vmct-website-update.timer /etc/systemd/system/vmct-website-update.timer
${SUDO} install -m 0755 server/update-dictionary.sh /usr/local/sbin/vmct-dictionary-update
${SUDO} install -m 0644 server/vmct-dictionary-update.service /etc/systemd/system/vmct-dictionary-update.service
${SUDO} install -m 0644 server/vmct-dictionary-update.timer /etc/systemd/system/vmct-dictionary-update.timer
while IFS= read -r legacy_conf; do
  [[ "${legacy_conf}" == "${NGINX_CONF_DIR}/www.vmct.top.conf" ]] || ${SUDO} rm -f "${legacy_conf}"
done < <(${SUDO} find "${NGINX_CONF_DIR}" -maxdepth 1 -type f -name '*www.vmct.top*' -print)
${SUDO} install -m 0644 server/nginx-www.vmct.top.conf "${NGINX_CONF_DIR}/www.vmct.top.conf"
if ${SUDO} test -f "${TLS_CERT_FILE}" && ${SUDO} test -f "${TLS_KEY_FILE}"; then
  tls_tmp="$(mktemp)"
  awk -v cert="${TLS_CERT_FILE}" -v key="${TLS_KEY_FILE}" '
    NR == 1 { print; next }
    NR == 2 { print "    listen 443 ssl;"; print "    ssl_certificate " cert ";"; print "    ssl_certificate_key " key ";"; next }
    { gsub(/listen 80;/, "listen 443 ssl;"); gsub(/listen \[::\]:80;/, "listen [::]:443 ssl;"); print }
  ' server/nginx-www.vmct.top.conf >"${tls_tmp}"
  ${SUDO} install -m 0644 "${tls_tmp}" "${NGINX_CONF_DIR}/www.vmct.top.ssl.conf"
  rm -f "${tls_tmp}"
else
  ${SUDO} rm -f "${NGINX_CONF_DIR}/www.vmct.top.ssl.conf"
  echo "未找到 www.vmct.top 的 TLS 证书，暂不配置 443；可通过 TLS_CERT_FILE/TLS_KEY_FILE 指定证书路径。" >&2
fi
${SUDO} systemctl daemon-reload
${SUDO} systemctl enable vmct-website-api
# Build code once per deployment. Published content is loaded at request time,
# so this step does not need the CMS export endpoint or a running API.
release_id="$(git -c "safe.directory=${APP_DIR}" -C "${APP_DIR}" rev-parse HEAD)-$(date +%s)"
site_release="${APP_DIR}/.site-releases/${release_id}"
run_as_vmct mkdir -p "${site_release}"
SITE_BUILD_DIR="${site_release}" NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=768}" \
  run_as_vmct "${PNPM_CMD[@]}" run build
# Publish new hashed assets before the new renderer can reference them. Keep
# both generations available while already-open clients finish navigating.
if [[ -d "${STATIC_ROOT}/assets" ]]; then
  run_as_vmct cp -an "${site_release}/assets/." "${STATIC_ROOT}/assets/"
fi
# Node resolves the SSR import through this symlink to an immutable release.
# Future builds therefore cannot remove the running renderer's lazy chunks.
if [[ -d "${APP_DIR}/dist" && ! -L "${APP_DIR}/dist" ]]; then
  run_as_vmct mv "${APP_DIR}/dist" "${APP_DIR}/.site-releases/legacy-${release_id}"
fi
run_as_vmct ln -s ".site-releases/${release_id}" "${APP_DIR}/.dist-next-${release_id}"
run_as_vmct mv -Tf "${APP_DIR}/.dist-next-${release_id}" "${APP_DIR}/dist"
${SUDO} systemctl restart vmct-website-api
${SUDO} systemctl --no-pager --full status vmct-website-api

api_ready=0
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error http://127.0.0.1:8787/api/content/admin/auth/status >/tmp/vmct-api-status.json; then
    api_ready=1
    break
  fi
  sleep 1
done
if [[ "${api_ready}" -ne 1 ]]; then
  echo 'ECS API 启动失败，最近日志如下：' >&2
  ${SUDO} journalctl -u vmct-website-api -n 80 --no-pager >&2
  exit 1
fi

# Update the active CMS backend, using the API's private database settings.
# Load credentials inside Node rather than putting a URL in shell arguments.
# Discard inherited DB overrides so deployment and the API select the same DB.
${SUDO} env -u VMCT_DATABASE_BACKEND -u VMCT_DATABASE_URL \
  node --env-file="${ENV_FILE}" --experimental-sqlite scripts/ensure-ecs-settings.mjs \
  "${DATA_DIR}/content.sqlite" \
  'http://127.0.0.1:8787/internal/rebuild'

if command -v docker >/dev/null 2>&1 && ${SUDO} docker ps --format '{{.Names}}' | grep -qx nginx; then
  # Publish browser assets; the Node service retains its private SSR bundle.
  ${SUDO} mkdir -p "$(dirname "${STATIC_ROOT}")"
  ${SUDO} chown vmct:vmct "$(dirname "${STATIC_ROOT}")"
  ${SUDO} docker exec nginx nginx -t
  ${SUDO} docker exec nginx nginx -s reload
  run_as_vmct env NGINX_STATIC_ROOT="${STATIC_ROOT}" node scripts/publish-static.mjs "${APP_DIR}/dist"
  curl --fail --silent --show-error -H 'Host: www.vmct.top' http://127.0.0.1/api/content/admin/auth/status
  curl --fail --silent --show-error -H 'Host: www.vmct.top' http://127.0.0.1/ >/dev/null
  echo
else
  echo '未检测到运行中的 nginx Docker 容器，无法完成单服务器静态站点部署。' >&2
  exit 1
fi

${SUDO} systemctl daemon-reload
# Record only a fully built and health-checked code deployment.
${SUDO} mkdir -p /var/lib/vmct-website
revision_tmp="$(${SUDO} mktemp /var/lib/vmct-website/.deployed-revision.XXXXXX)"
git -c "safe.directory=${APP_DIR}" -C "${APP_DIR}" rev-parse HEAD | ${SUDO} tee "${revision_tmp}" >/dev/null
${SUDO} mv -f "${revision_tmp}" /var/lib/vmct-website/deployed-revision
if [[ "${VMCT_KEEP_UPDATE_TIMERS_STOPPED:-0}" != 1 ]]; then
  ${SUDO} systemctl enable --now vmct-website-update.timer
  ${SUDO} systemctl enable --now vmct-dictionary-update.timer
fi

echo "单 ECS 部署完成：动态官网、原 API 和 Nginx 已启动。内容发布即时生效；代码更新时才构建。"
