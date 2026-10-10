#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/vmct-website}"
DATA_DIR="${VMCT_DATA_DIR:-/var/lib/vmct-website/data}"
DB_PATH="${DICT_DB_PATH:-${DATA_DIR}/dictionary.sqlite}"
STATE_FILE="${DATA_DIR}/dictionary-release.json"
API_SERVICE="vmct-website-api.service"
HELPER="${APP_DIR}/scripts/dictionary-update.mjs"
mkdir -p "${DATA_DIR}" "$(dirname "${DB_PATH}")"
exec 9>"${APP_DIR}/.vmct-deploy.lock"
flock -w 300 9

work_dir="$(mktemp -d "$(dirname "${DB_PATH}")/.dictionary-update.XXXXXX")"
backup_path="${work_dir}/previous.sqlite"
api_stopped=0
swapped=0
committed=0
cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if [[ "${committed}" -eq 0 && "${api_stopped}" -eq 1 ]]; then
    echo 'Dictionary update failed; restoring the previous database.' >&2
    if systemctl stop "${API_SERVICE}"; then
      if [[ "${swapped}" -eq 1 ]]; then
        rm -f "${DB_PATH}" "${DB_PATH}-wal" "${DB_PATH}-shm"
      fi
      if [[ -f "${backup_path}" ]]; then mv -f "${backup_path}" "${DB_PATH}"; fi
      systemctl start "${API_SERVICE}" || true
    else
      echo "Cannot stop API for rollback. Recovery files retained at ${work_dir}" >&2
      exit "${status}"
    fi
  fi
  rm -rf "${work_dir}"
  exit "${status}"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

curl --fail --silent --show-error --location --retry 3 --connect-timeout 15 --max-time 120 \
  --header 'Accept: application/vnd.github+json' --header 'User-Agent: vmct-dictionary-updater' \
  'https://api.github.com/repos/VM-Chinese-translate-group/i18n-Dict-Extender/releases/latest' \
  --output "${work_dir}/release.json"
node --experimental-sqlite "${HELPER}" select "${work_dir}/release.json" "${work_dir}/manifest.json" "${STATE_FILE}"
if [[ -f "${DB_PATH}" ]] && node -e 'process.exit(JSON.parse(require("fs").readFileSync(process.argv[1])).unchanged ? 0 : 1)' "${work_dir}/manifest.json"; then
  exit 0
fi
asset_url="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).url)' "${work_dir}/manifest.json")"
curl --fail --silent --show-error --location --retry 3 --connect-timeout 15 --max-time 1200 \
  "${asset_url}" --output "${work_dir}/dictionary.sqlite"
node --experimental-sqlite "${HELPER}" verify "${work_dir}/dictionary.sqlite" "${work_dir}/manifest.json"
node --experimental-sqlite "${HELPER}" prepare "${work_dir}/dictionary.sqlite"
chown vmct:vmct "${work_dir}/dictionary.sqlite"
chmod 0644 "${work_dir}/dictionary.sqlite"

# Downloading and indexing happen while the API still serves the old database.
# Stop it only for the atomic replacement, then discard its in-memory caches.
api_stopped=1
systemctl stop "${API_SERVICE}"
node --experimental-sqlite "${HELPER}" checkpoint "${DB_PATH}"
if [[ -f "${DB_PATH}" ]]; then mv "${DB_PATH}" "${backup_path}"; fi
mv "${work_dir}/dictionary.sqlite" "${DB_PATH}"
swapped=1
systemctl start "${API_SERVICE}"
healthy=0
for ((attempt=1; attempt<=${DICTIONARY_HEALTH_ATTEMPTS:-15}; attempt++)); do
  if node --experimental-sqlite "${HELPER}" health "${DICTIONARY_API_ORIGIN:-http://127.0.0.1:8787}"; then
    healthy=1
    break
  fi
  sleep 1
done
[[ "${healthy}" -eq 1 ]] || exit 1
if [[ -f "${backup_path}" ]]; then
  mv -f "${backup_path}" "${DB_PATH}.previous"
  backup_path="${DB_PATH}.previous"
fi
chmod 0644 "${work_dir}/manifest.json"
mv -f "${work_dir}/manifest.json" "${STATE_FILE}"
committed=1
echo 'Dictionary update completed.'
