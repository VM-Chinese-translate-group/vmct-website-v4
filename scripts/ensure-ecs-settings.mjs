import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'

const databasePath = process.argv[2]
const rebuildHook = process.argv[3] || 'http://127.0.0.1:8787/internal/rebuild'

if (!databasePath) {
  console.error('用法：node --experimental-sqlite scripts/ensure-ecs-settings.mjs <content.sqlite> [hook]')
  process.exit(2)
}
if (!fs.existsSync(databasePath)) {
  console.error(`找不到内容数据库：${databasePath}`)
  process.exit(1)
}
if (!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/.test(rebuildHook)) {
  console.error(`ECS 重建地址必须是本机 HTTP 地址：${rebuildHook}`)
  process.exit(2)
}

const database = new DatabaseSync(databasePath)
try {
  database.exec('PRAGMA busy_timeout = 5000')
  database.exec('BEGIN IMMEDIATE')
  database
    .prepare(
      "INSERT INTO cms_settings (setting_key, setting_value, updated_at) VALUES ('deployment_hook_url', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at",
    )
    .run(rebuildHook)
  database.exec('COMMIT')
} catch (error) {
  try {
    database.exec('ROLLBACK')
  } catch {
    // Preserve the original database error.
  }
  throw error
} finally {
  database.close()
}

console.log(`已将 deployment_hook_url 设置为 ${rebuildHook}`)
