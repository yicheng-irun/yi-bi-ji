import { Hono } from 'hono'
import { getBackupConfig, syncBackup, testBackupConnection } from '../services/backup.js'

export const backupRoutes = new Hono()

backupRoutes.post('/test', async (c) => {
  const config = getBackupConfig()
  try {
    await testBackupConnection(config)
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message }, 400)
  }
})

backupRoutes.post('/sync', async (c) => {
  const config = getBackupConfig()
  try {
    const result = await syncBackup(config)
    return c.json(result)
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message }, 400)
  }
})
