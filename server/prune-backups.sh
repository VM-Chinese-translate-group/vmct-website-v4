#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/vmct-website}"
VMPM_DIR="${VMPM_DIR:-/home/vmct/vmpm}"
lock_file="${DEPLOY_LOCK_FILE:-${APP_DIR}/.vmct-deploy.lock}"

# Reuse the website deployer's inherited lock, including a custom lock path.
if [[ "$(readlink "/proc/$$/fd/9" 2>/dev/null || true)" != "${lock_file}" ]]; then
  exec 9>"${lock_file}"
fi
if ! flock -n 9; then
  echo '已有官网部署正在进行，跳过备份清理。'
  exit 0
fi
# VMPM manual releases use these locks. A busy release is retried by the next
# website timer check; never wait while holding locks in a different order.
if [[ -d "${VMPM_DIR}" ]]; then
  exec 8>"${VMPM_DIR}/.deploy.lock"
  exec 7>"${VMPM_DIR}/.ux-deploy.lock"
  exec 6>"${VMPM_DIR}/.qq-login-deploy.lock"
  if ! flock -n 8 || ! flock -n 7 || ! flock -n 6; then
    echo '已有 VMPM 部署正在进行，跳过备份清理。'
    exit 0
  fi
fi

exec node "${APP_DIR}/scripts/prune-backups.mjs" "$@"
