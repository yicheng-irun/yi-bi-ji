import { Hono } from 'hono'
import fs from 'node:fs'
import path from 'node:path'
import { env } from '../env.js'

export const screenshotsRoutes = new Hono()

/** 提供 browser_screenshot 生成的截图（dataDir/screenshots/*.png） */
screenshotsRoutes.get('/:file', async (c) => {
  const file = c.req.param('file')
  if (!/^[A-Za-z0-9._-]+\.png$/.test(file)) return c.json({ error: 'bad file name' }, 400)
  const full = path.join(env.dataDir, 'screenshots', file)
  if (!fs.existsSync(full)) return c.json({ error: 'not found' }, 404)
  const buf = await fs.promises.readFile(full)
  c.header('Content-Type', 'image/png')
  c.header('Cache-Control', 'public, max-age=3600')
  return c.body(buf)
})
