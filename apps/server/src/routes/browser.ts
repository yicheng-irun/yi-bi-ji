import { Hono } from 'hono'
import { getSettings } from '../services/settings.js'
import { closeCdpBrowser, getCdpBrowser, listCdpTabs, testCdpConnection } from '../services/cdp.js'

export const browserRoutes = new Hono()

function currentConfig() {
  const s = getSettings()
  return {
    enabled: s.browserCdpEnabled === '1',
    url: s.browserCdpUrl || 'http://127.0.0.1:9222',
  }
}

/** 浏览器控制当前状态：配置 + 连通性（设置页打开时展示） */
browserRoutes.get('/status', async (c) => {
  const cfg = currentConfig()
  if (!cfg.enabled) {
    return c.json({ ...cfg, connected: false, reason: '未启用' })
  }
  try {
    const browser = await getCdpBrowser()
    const version = String(await browser.version())
    const tabs = await listCdpTabs()
    return c.json({ ...cfg, connected: true, version, tabs: tabs.tabs })
  } catch (e) {
    return c.json({ ...cfg, connected: false, reason: (e as Error).message })
  }
})

/** 用页面填写的地址试连一次（不落库），返回版本与当前打开的标签页 */
browserRoutes.post('/test', async (c) => {
  const body = await c.req.json<{ url?: string }>().catch(() => ({}) as { url?: string })
  const url = body.url?.trim() || currentConfig().url
  return c.json({ ...(await testCdpConnection(url)), url })
})

/** 断开 CDP 连接（不关闭用户浏览器），下次工具调用会重连 */
browserRoutes.post('/disconnect', async (c) => {
  await closeCdpBrowser()
  return c.json({ ok: true })
})
