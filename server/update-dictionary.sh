#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/vmct-website}"
DATA_DIR="${VMCT_DATA_DIR:-/var/lib/vmct-website/data}"
DB_PATH="${DICT_DB_PATH:-${DATA_DIR}/dictionary.sqlite}"
STATE_FILE="${DATA_DIR}/dictionary-release.json"
API_SERVICE="vmct-website-api.service"
HELPER="${APP_DIR}/scripts/dictionary-update.mjs"
mkdir -p "${DATA_DIR}" "$(dirname "${DB_PATH}")"
exec 8>"${DATA_DIR}/.dictionary-update.lock"
flock -n 8 || exit 0
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

# Keep a stable helper across website deployments, without holding their lock
# during a potentially slow GitHub download.
cp "${HELPER}" "${work_dir}/helper.mjs"
HELPER="${work_dir}/helper.mjs"
flock -u 9

curl --fail --silent --show-error --location --retry 3 --connect-timeout 15 --max-time 120 \
  --header 'Accept: application/vnd.github+json' --header 'User-Agent: vmct-dictionary-updater' \
  'https://api.github.com/repos/VM-Chinese-translate-group/i18n-Dict-Extender/releases/latest' \
  --output "${work_dir}/release.json"
node --experimental-sqlite "${HELPER}" select "${work_dir}/release.json" "${work_dir}/manifest.json" "${STATE_FILE}"
if [[ -f "${DB_PATH}" ]] && node -e 'process.exit(JSON.parse(require("fs").readFileSync(process.argv[1])).unchanged ? 0 : 1)' "${work_dir}/manifest.json"; then
  exit 0
fi
asset_url="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).url)' "${work_dir}/manifest.json")"
asset_id="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).assetId)' "${work_dir}/manifest.json")"
cache_dir="${DATA_DIR}/.dictionary-download"
mkdir -p "${cache_dir}"
chmod 0700 "${cache_dir}"
download_file="${cache_dir}/${asset_id}.sqlite"
if ! node -e 'const fs=require("fs"), m=JSON.parse(fs.readFileSync(process.argv[2])); process.exit(fs.existsSync(process.argv[1]) && fs.statSync(process.argv[1]).size === m.size ? 0 : 1)' "${download_file}" "${work_dir}/manifest.json"; then
  curl --fail --silent --show-error --location --retry 3 --connect-timeout 15 --max-time 10800 \
    --continue-at - "${asset_url}" --output "${download_file}"
fi
if ! node --experimental-sqlite "${HELPER}" verify "${download_file}" "${work_dir}/manifest.json"; then
  rm -f "${download_file}"
  exit 1
fi
cp "${download_file}" "${work_dir}/dictionary.sqlite"
node --experimental-sqlite "${HELPER}" prepare "${work_dir}/dictionary.sqlite"
chown vmct:vmct "${work_dir}/dictionary.sqlite"
chmod 0644 "${work_dir}/dictionary.sqlite"

# Downloading and indexing happen while the API still serves the old database.
# Stop it only for the atomic replacement, then discard its in-memory caches.
flock -w 300 9
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
rm -f "${download_file}"
echo 'Dictionary update completed.'
