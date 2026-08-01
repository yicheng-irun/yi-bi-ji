import { api, check, section } from './helpers.mts'

export async function runBrowserTests() {
  section('浏览器控制（CDP）')

  const s1 = await api<{ enabled: boolean; connected: boolean; reason?: string }>('/api/browser/status')
  check('默认未启用（未配 BROWSER_CDP_URL）', s1.status === 200 && s1.body.enabled === false)

  const t1 = await api<{ ok: boolean; reason?: string }>('/api/browser/test', {
    method: 'POST',
    body: JSON.stringify({ url: 'http://127.0.0.1:9' }),
  })
  check('测试连接（端口未开）返回失败', t1.status === 200 && t1.body.ok === false && !!t1.body.reason)

  await api('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ browserCdpEnabled: '1', browserCdpUrl: 'http://127.0.0.1:9' }),
  })
  const s2 = await api<{ enabled: boolean; connected: boolean; reason?: string }>('/api/browser/status')
  check('启用后返回未连接（端口未开）', s2.status === 200 && s2.body.enabled === true && s2.body.connected === false && !!s2.body.reason)

  const settings = await api<{ browserCdpEnabled: string; browserCdpUrl: string }>('/api/settings')
  check('设置持久化 browserCdpEnabled/Url', settings.body.browserCdpEnabled === '1' && settings.body.browserCdpUrl === 'http://127.0.0.1:9')

  await api('/api/settings', { method: 'PUT', body: JSON.stringify({ browserCdpEnabled: '0' }) })
}
