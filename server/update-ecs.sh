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
local_revision="$("${git_cmd[@]}" rev-parse "${BRANCH}")"
remote_revision="$("${git_cmd[@]}" rev-parse "origin/${BRANCH}")"

if [[ "${local_revision}" == "${remote_revision}" ]]; then
  exit 0
fi

echo "检测到 ${BRANCH} 更新：${local_revision} -> ${remote_revision}"
exec bash "${APP_DIR}/server/deploy-ecs.sh"
