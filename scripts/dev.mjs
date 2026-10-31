process.env.VMCT_VITE_DEV = '1'
process.env.HOST ||= '127.0.0.1'
process.env.PORT ||= '5173'
await import('../server/index.mjs')
