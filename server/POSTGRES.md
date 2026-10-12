官网 ECS 使用 PostgreSQL 时，设置 `VMCT_DATABASE_BACKEND=postgres` 和服务器私有环境文件内的 `VMCT_DATABASE_URL`。Cloudflare D1 部署与数据保持原状。官网与 VMPM 使用独立数据库；官网数据库分为 `content`、`feedback`、`dictionary` 三个 schema。

首次迁移应先备份数据库、停止官网 API 及相关更新定时器，再运行：

```sh
node --experimental-sqlite scripts/migrate-postgres.mjs
```

脚本以 SQLite backup API 保存一致快照，在一个 PostgreSQL 事务内导入所有业务表，逐表比较行数和完整 CSV 内容的 SHA-256。保留正文、历史修订、会话、投票、词典 ID 和自增序列；SQLite FTS 内部表由 PostgreSQL 全文索引和中文 trigram 索引代替。失败回滚整个导入，原 SQLite 文件不删除。

切换前运行 `VMCT_DATABASE_URL=... node --experimental-sqlite --test server/postgres.test.mjs`。切换后验证内容导出、反馈列表、词典中英文查询与分页。配置/代码回滚可以在尚未产生新写入时恢复原 SQLite；已产生新写入后应先导出 PostgreSQL 的增量，不能直接切回旧副本。

词典更新服务继承 `/etc/vmct-website/api.env`。下载的 SQLite 仅作为上游交换格式：导入并验证 `dictionary_next`，建好索引后用短事务替换活动 schema，保留上次版本为 `dictionary_previous`，再重启 API 清除旧缓存。

现有官网懒汉下载入口暂不自动修改。资源目录与文件下载仍由 VMPM 管理；本次统一数据库引擎，为后续接入保留条件。
