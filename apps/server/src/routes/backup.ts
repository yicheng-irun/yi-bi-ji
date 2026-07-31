import { Hono } from 'hono'
import { getBackupConfig, syncToMysql, testMysqlConnection } from '../services/backup.js'

export const backupRoutes = new Hono()

backupRoutes.post('/test', async (c) => {
  const config = getBackupConfig()
  if (!config.backupHost || !config.backupDatabase) {
    return c.json({ ok: false, error: '请先填写并保存 MySQL 连接信息（Host / 数据库名）' }, 400)
  }
  try {
    await testMysqlConnection(config)
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message }, 400)
  }
})

backupRoutes.post('/sync', async (c) => {
  const config = getBackupConfig()
  if (!config.backupHost || !config.backupDatabase) {
    return c.json({ ok: false, error: '请先填写并保存 MySQL 连接信息（Host / 数据库名）' }, 400)
  }
  try {
    const result = await syncToMysql(config)
    return c.json(result)
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message }, 400)
  }
})
