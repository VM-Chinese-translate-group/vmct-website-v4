#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/vmct-website}"
BRANCH="${DEPLOY_BRANCH:-cn-mainland}"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "找不到项目仓库：${APP_DIR}" >&2
  exit 1
fi

git_cmd=(git -c "safe.directory=${APP_DIR}" -C "${APP_DIR}")
fetch_ok=0
for attempt in 1 2 3; do
  if "${git_cmd[@]}" -c http.version=HTTP/1.1 fetch --quiet origin "${BRANCH}"; then
    fetch_ok=1
    break
  fi
  [[ "${attempt}" -eq 3 ]] || sleep 5
done
if [[ "${fetch_ok}" -ne 1 ]]; then
  echo "无法从 origin 获取 ${BRANCH}，等待下一轮定时检查。" >&2
  exit 1
fi
state_file="${DEPLOY_STATE_FILE:-/var/lib/vmct-website/deployed-revision}"
local_revision="$(cat "${state_file}" 2>/dev/null || true)"
remote_revision="$("${git_cmd[@]}" rev-parse "origin/${BRANCH}")"

if [[ "${local_revision}" == "${remote_revision}" ]]; then
  exit 0
fi

echo "检测到 ${BRANCH} 更新：${local_revision} -> ${remote_revision}"
lock_file="${DEPLOY_LOCK_FILE:-${APP_DIR}/.vmct-deploy.lock}"
exec 9>"${lock_file}"
if ! flock -n 9; then
  echo '已有 ECS 部署正在进行，跳过本次更新。'
  exit 0
fi
if ! "${git_cmd[@]}" diff --quiet HEAD -- server scripts; then
  echo '部署脚本有未提交修改，请先合入部署分支。' >&2
  exit 1
fi
# Refresh under the shared lock before loading the deployer. Otherwise Bash
# keeps executing the old script after its checkout, including an obsolete
# restart-before-build sequence during a static-to-dynamic upgrade.
"${git_cmd[@]}" checkout "${BRANCH}"
"${git_cmd[@]}" reset --hard "origin/${BRANCH}"
# The new deployer reuses inherited descriptor 9 for the same lock file.
export DEPLOY_LOCK_FILE="${lock_file}"

exec bash "${APP_DIR}/server/deploy-ecs.sh"
