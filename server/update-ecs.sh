#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/vmct-website}"
BRANCH="${DEPLOY_BRANCH:-cn-mainland}"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "找不到项目仓库：${APP_DIR}" >&2
  exit 1
fi

lock_file="${DEPLOY_LOCK_FILE:-${APP_DIR}/.vmct-deploy.lock}"
exec 9>"${lock_file}"
if ! flock -n 9; then
  echo '已有 ECS 部署正在进行，跳过本次更新。'
  exit 0
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
purge_state_file="${ESA_PURGE_STATE_FILE:-$(dirname "${state_file}")/esa-purge-state}"
purge_pending_file="${ESA_PURGE_PENDING_FILE:-$(dirname "${state_file}")/esa-purge-pending}"
local_revision="$(cat "${state_file}" 2>/dev/null || true)"
remote_revision="$("${git_cmd[@]}" rev-parse "origin/${BRANCH}")"

if [[ "${local_revision}" == "${remote_revision}" && ! -f "${purge_pending_file}" ]]; then
  exit 0
fi

# Fail before touching the worktree if a completed deployment cannot be purged.
if [[ ! "${ESA_SITE_ID:-}" =~ ^[1-9][0-9]*$ ]]; then
  echo '请在 /etc/vmct-website/update.env 配置有效的 ESA_SITE_ID。' >&2
  exit 1
fi
if ! command -v aliyun >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
  echo '自动更新需要阿里云 CLI（aliyun）和 Node.js，以检查额度并刷新 ESA 全站缓存。' >&2
  exit 1
fi

esa_flags=(--version 2024-09-10 --region "${ESA_REGION:-cn-hangzhou}"
  --SiteId "${ESA_SITE_ID}" --Type purgeall
  --retry-count 0 --connect-timeout 10 --read-timeout 60)
if [[ -n "${ESA_CLI_PROFILE:-}" ]]; then
  esa_flags+=(--profile "${ESA_CLI_PROFILE}")
fi
if [[ -n "${ESA_CLI_CONFIG_PATH:-}" ]]; then
  esa_flags+=(--config-path "${ESA_CLI_CONFIG_PATH}")
fi

write_state() {
  local target="$1" value="$2" temporary
  mkdir -p "$(dirname "${target}")"
  temporary="$(mktemp "${target}.XXXXXX")"
  printf '%s\n' "${value}" >"${temporary}"
  mv -f "${temporary}" "${target}"
}

check_purge_quota() {
  local saved quota_json quota_values cloud_quota cloud_used
  purge_day="$(TZ=Asia/Shanghai date +%F)"
  purge_used=0
  purge_available=0
  if [[ -f "${purge_state_file}" ]]; then
    saved="$(cat "${purge_state_file}")"
    if [[ ! "${saved}" =~ ^([0-9]{4}-[0-9]{2}-[0-9]{2})\ ([1-9][0-9]*)\ ([0-3])$ ]]; then
      echo "ESA 刷新计数文件无效，停止自动更新：${purge_state_file}" >&2
      exit 1
    fi
    if [[ "${BASH_REMATCH[2]}" != "${ESA_SITE_ID}" || "${BASH_REMATCH[1]}" > "${purge_day}" ]]; then
      echo 'ESA 站点或日期与刷新计数不符，请检查配置和服务器时间。' >&2
      exit 1
    fi
    if [[ "${BASH_REMATCH[1]}" == "${purge_day}" ]]; then
      purge_used="${BASH_REMATCH[3]}"
    fi
  fi
  if (( purge_used >= 3 )); then
    echo "${purge_day}（北京时间）的 ESA 全站刷新额度已用完，自动更新推迟到次日，仅部署届时的分支最新版。"
    return
  fi
  if ! quota_json="$(aliyun esa GetPurgeQuota "${esa_flags[@]}")"; then
    echo '无法查询 ESA 全站刷新额度，保留当前部署，等待下一轮检查。' >&2
    exit 1
  fi
  if ! quota_values="$(node -e '
    const data = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
    for (const key of ["Quota", "Usage"]) {
      if (!/^(0|[1-9][0-9]*)$/.test(String(data[key])) || !Number.isSafeInteger(Number(data[key]))) process.exit(1);
    }
    console.log(`${data.Quota} ${data.Usage}`);
  ' <<<"${quota_json}")"; then
    echo 'ESA 返回的刷新额度无效，停止自动更新。' >&2
    exit 1
  fi
  read -r cloud_quota cloud_used <<<"${quota_values}"
  # The API also accounts for console/manual purges. Local reservations cover
  # timeouts where ESA may have accepted a request without returning a response.
  if (( cloud_used > purge_used )); then
    purge_used="${cloud_used}"
  fi
  if (( purge_used >= 3 || purge_used >= cloud_quota )); then
    echo "${purge_day}（北京时间）的 ESA 全站刷新额度已用完，自动更新推迟到次日，仅部署届时的分支最新版。"
    return
  fi
  purge_available=1
}

check_purge_quota
if [[ "${purge_available}" -eq 0 ]]; then
  exit 0
fi

if [[ "${local_revision}" != "${remote_revision}" ]]; then
  echo "检测到 ${BRANCH} 更新：${local_revision} -> ${remote_revision}"
  if ! "${git_cmd[@]}" diff --quiet HEAD -- server scripts; then
    echo '部署脚本有未提交修改，请先合入部署分支。' >&2
    exit 1
  fi
  # A durable marker survives interruption after deployment records its SHA.
  # Overwrite it for the latest branch tip instead of queuing individual commits.
  write_state "${purge_pending_file}" "${remote_revision}"
  # Refresh under the shared lock before loading the deployer. Otherwise Bash
  # keeps executing an old deployer after checkout during an upgrade.
  "${git_cmd[@]}" checkout "${BRANCH}"
  "${git_cmd[@]}" reset --hard "origin/${BRANCH}"
  # Keep descriptor 9 locked across deployment AND the subsequent cache purge.
  export DEPLOY_LOCK_FILE="${lock_file}"
  bash "${APP_DIR}/server/deploy-ecs.sh"

  # Builds can cross midnight, and an operator can purge during a build.
  check_purge_quota
  if [[ "${purge_available}" -eq 0 ]]; then
    exit 0
  fi
fi

# Reserve before sending, and disable CLI retries: a timed-out request might
# already have consumed a slot. Failed builds never consume a purge slot.
write_state "${purge_state_file}" "${purge_day} ${ESA_SITE_ID} $((purge_used + 1))"
if ! purge_json="$(aliyun esa PurgeCaches "${esa_flags[@]}" --Content '{"PurgeAll":true}' --Force true)"; then
  echo '部署后的 ESA 全站刷新失败，已保留待刷新状态；下次检查会重试，仍受每日三次上限约束。' >&2
  exit 1
fi
if ! node -e '
  const data = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
  if (!data.TaskId || !["string", "number"].includes(typeof data.TaskId)) process.exit(1);
' <<<"${purge_json}"; then
  echo 'ESA 未返回有效刷新任务 ID，保留待刷新状态，等待下一轮检查。' >&2
  exit 1
fi
rm -f "${purge_pending_file}"
echo "已提交 ESA 全站缓存刷新，${purge_day}（北京时间）已使用/预留 $((purge_used + 1))/3 次。"
