import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const input = process.argv[2]
const output = process.argv[3] || process.env.DICT_DB_PATH || '/var/lib/vmct-website/data/dictionary.sqlite'

if (!input) {
  console.error('用法：node scripts/import-dictionary.mjs <d1backup.sql> [dictionary.sqlite]')
  process.exit(1)
}

fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true })
const database = new DatabaseSync(output)
database.exec('PRAGMA journal_mode = WAL;')
database.exec(fs.readFileSync(input, 'utf8'))
database.close()
console.log(`字典数据库已导入：${output}`)
