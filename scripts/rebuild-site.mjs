// Compatibility command for the old content rebuild workflow. Code updates
// use deploy-ecs.sh; published content only needs runtime cache invalidation.
const target = new URL(process.env.SITE_REBUILD_HOOK_URL || 'http://127.0.0.1:8787/internal/rebuild')
if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(target.hostname))
  throw new Error('缓存刷新地址必须是本机 HTTP 地址')
if (!process.env.SITE_REBUILD_SECRET) throw new Error('请通过私有环境配置提供 SITE_REBUILD_SECRET')
const response = await fetch(target, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
  headers: { Authorization: 'Bearer ' + process.env.SITE_REBUILD_SECRET },
})
if (!response.ok) throw new Error('缓存刷新失败：HTTP ' + response.status)
console.log('站点缓存已刷新；内容发布无需构建。')
