import { chromium, type Browser, type Page } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { env } from '../env.js'
import { getSettings } from './settings.js'
import { extractPageContent, normalizeText } from './extract.js'

/**
 * CDP 模式：连接用户本机已启动的真实浏览器（Edge/Chrome，需 --remote-debugging-port 启动）。
 * 直接读已打开、已登录的页面，可绕过大多数反爬/登录验证；点击/输入等操作会真实作用于浏览器。
 */

/** 从设置（可覆盖 .env）读取浏览器控制配置 */
function cdpConfig(): { enabled: boolean; url: string } {
  const s = getSettings()
  return {
    enabled: s.browserCdpEnabled === '1',
    url: s.browserCdpUrl || 'http://127.0.0.1:9222',
  }
}

function cdpUrl(): string {
  const { url } = cdpConfig()
  return /^https?:\/\//i.test(url) ? url : `http://${url}`
}

let cdpBrowserPromise: Promise<Browser> | null = null

async function connectCdp(): Promise<Browser> {
  const url = cdpUrl()
  const browser = await chromium.connectOverCDP(url)
  browser.on('disconnected', () => {
    cdpBrowserPromise = null
  })
  console.log(`[browser] ✅ 已连接本机浏览器 (CDP ${url})`)
  return browser
}

/** 获取 CDP 连接；失败抛出带启动提示的友好错误 */
export async function getCdpBrowser(): Promise<Browser> {
  if (!cdpConfig().enabled) {
    throw new Error('浏览器控制未启用，请先在「设置 → 浏览器控制」里启用并填写 CDP 地址')
  }
  if (!cdpBrowserPromise) {
    cdpBrowserPromise = connectCdp().catch((err) => {
      cdpBrowserPromise = null
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(
        `未检测到本机浏览器调试端口（${cdpUrl()}）。请先以 --remote-debugging-port=9222 启动浏览器（Windows 可双击仓库里的 scripts/start-browser-cdp.bat），再让我操作浏览器。原始错误：${msg.slice(0, 120)}`,
      )
    })
  }
  return cdpBrowserPromise
}

export async function closeCdpBrowser() {
  if (cdpBrowserPromise) {
    const b = await cdpBrowserPromise.catch(() => null)
    cdpBrowserPromise = null
    // CDP 断开连接即可，不关闭用户自己的浏览器
    await b?.close().catch(() => {})
  }
}

function cdpError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.length > 300 ? msg.slice(0, 300) : msg
}

export interface CdpTab {
  index: number
  title: string
  url: string
}

async function collectTabs(browser: Browser): Promise<CdpTab[]> {
  const tabs: CdpTab[] = []
  for (const ctx of browser.contexts()) {
    const pages = ctx.pages()
    const metas = await Promise.all(
      pages.map(async (p) => ({ title: await p.title().catch(() => ''), url: p.url() })),
    )
    for (const m of metas) {
      tabs.push({ index: tabs.length, title: m.title, url: m.url })
    }
  }
  return tabs
}

export async function listCdpTabs(): Promise<{ ok: boolean; tabs: CdpTab[]; reason?: string }> {
  try {
    const browser = await getCdpBrowser()
    const tabs = await collectTabs(browser)
    return { ok: tabs.length > 0, tabs }
  } catch (e) {
    return { ok: false, tabs: [], reason: cdpError(e) }
  }
}

export interface CdpConnectionInfo {
  ok: boolean
  version?: string
  tabs?: CdpTab[]
  reason?: string
}

/** 用指定地址试连一次浏览器（设置页「测试连接」用，不落库、不影响缓存的连接） */
export async function testCdpConnection(url: string): Promise<CdpConnectionInfo> {
  try {
    const target = /^https?:\/\//i.test(url) ? url : `http://${url}`
    const browser = await chromium.connectOverCDP(target)
    const version = String(await browser.version())
    const tabs = await collectTabs(browser)
    await browser.close().catch(() => {})
    return { ok: true, version, tabs }
  } catch (e) {
    return { ok: false, reason: cdpError(e) }
  }
}

/** 选出要操作的标签页：优先当前聚焦且可见的页，否则取指定序号，最后兜底取最后一个非空白页 */
async function pickPage(browser: Browser, index?: number): Promise<Page> {
  const pages = browser.contexts().flatMap((ctx) => ctx.pages()).filter((p) => !p.isClosed())
  if (pages.length === 0) throw new Error('浏览器里没有打开的标签页，请先打开一个网页')

  if (index !== undefined) {
    if (index < 0 || index >= pages.length) {
      throw new Error(`标签页序号 ${index} 不存在，当前共 ${pages.length} 个标签页（用 browser_tabs 查看）`)
    }
    return pages[index]
  }

  for (const p of pages) {
    try {
      if (await p.evaluate(() => document.visibilityState === 'visible' && document.hasFocus())) return p
    } catch {
      // page 可能已关闭
    }
  }
  for (const p of pages) {
    try {
      if (await p.evaluate(() => document.visibilityState === 'visible')) return p
    } catch {
      // page 可能已关闭
    }
  }
  for (let i = pages.length - 1; i >= 0; i--) {
    if (pages[i].url() && !pages[i].url().startsWith('about:')) return pages[i]
  }
  return pages[0]
}

export interface ReadResult {
  ok: boolean
  url?: string
  title?: string
  totalChars?: number
  start?: number
  format?: 'markdown' | 'text'
  content?: string
  reason?: string
}

export async function readCdpPage(
  index?: number,
  start = 0,
  maxChars = 8000,
  format: 'markdown' | 'text' = 'markdown',
): Promise<ReadResult> {
  try {
    const browser = await getCdpBrowser()
    const page = await pickPage(browser, index)
    await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(400)

    const url = page.url()
    const html = await page.content()
    const extracted = extractPageContent(html, url)
    let title = extracted.title || (await page.title().catch(() => ''))
    let content =
      format === 'markdown' && extracted.markdown.trim() ? normalizeText(extracted.markdown) : extracted.text.trim()
    if (!content) {
      const bodyText = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '')
      content = bodyText.trim()
      if (!title) title = ''
    }
    if (!content) return { ok: false, url, reason: '页面没有可提取的内容' }

    const s = Math.max(0, start)
    return {
      ok: true,
      url,
      title,
      totalChars: content.length,
      start: s,
      format,
      content: content.slice(s, s + maxChars),
    }
  } catch (e) {
    return { ok: false, reason: cdpError(e) }
  }
}

export interface ScreenshotResult {
  ok: boolean
  url?: string
  path?: string
  pageUrl?: string
  title?: string
  reason?: string
}

export async function screenshotCdpPage(
  index?: number,
  name = 'screenshot',
  fullPage = false,
): Promise<ScreenshotResult> {
  try {
    const browser = await getCdpBrowser()
    const page = await pickPage(browser, index)
    const dir = path.join(env.dataDir, 'screenshots')
    fs.mkdirSync(dir, { recursive: true })
    const safe = name.replace(/[^A-Za-z0-9_\-\u4e00-\u9fa5]/g, '').slice(0, 40) || 'screenshot'
    const file = `${new Date().toISOString().replace(/[:.]/g, '-')}-${safe}.png`
    const full = path.join(dir, file)
    await page.screenshot({ path: full, fullPage })
    return {
      ok: true,
      url: `/api/screenshots/${file}`,
      path: full,
      pageUrl: page.url(),
      title: await page.title().catch(() => ''),
    }
  } catch (e) {
    return { ok: false, reason: cdpError(e) }
  }
}

export interface NavigateResult {
  ok: boolean
  url?: string
  openedNew?: boolean
  title?: string
  reason?: string
}

export async function navigateCdpPage(
  url: string,
  index?: number,
  newTab = false,
): Promise<NavigateResult> {
  try {
    let parsed: URL
    try {
      parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) return { ok: false, reason: '只支持 http/https 链接' }
    } catch {
      return { ok: false, reason: 'URL 格式不正确' }
    }

    const browser = await getCdpBrowser()
    let page: Page
    let openedNew = false
    if (newTab) {
      page = await browser.newPage()
      openedNew = true
    } else {
      page = await pickPage(browser, index)
    }
    await page.goto(parsed.href, { waitUntil: 'domcontentloaded', timeout: 30000 })
    return {
      ok: true,
      url: page.url(),
      openedNew,
      title: await page.title().catch(() => ''),
    }
  } catch (e) {
    return { ok: false, reason: cdpError(e) }
  }
}

async function resolveTarget(
  page: Page,
  selector?: string,
  text?: string,
): Promise<ReturnType<Page['locator']> | null> {
  if (selector && selector.trim()) {
    const loc = page.locator(selector).first()
    if ((await loc.count()) > 0) return loc
  }
  if (text && text.trim()) {
    const loc = page.getByText(text, { exact: false }).first()
    if ((await loc.count()) > 0) return loc
  }
  return null
}

export interface ClickResult {
  ok: boolean
  url?: string
  title?: string
  reason?: string
}

export async function cdpClick(args: { selector?: string; text?: string; index?: number }): Promise<ClickResult> {
  try {
    const browser = await getCdpBrowser()
    const page = await pickPage(browser, args.index)
    const target = await resolveTarget(page, args.selector, args.text)
    if (!target) return { ok: false, reason: '找不到要点击的元素，换个 selector 或 text 试试' }
    await target.click({ timeout: 5000 })
    await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {})
    return { ok: true, url: page.url(), title: await page.title().catch(() => '') }
  } catch (e) {
    return { ok: false, reason: cdpError(e) }
  }
}

export interface EvalResult {
  ok: boolean
  result?: string
  reason?: string
}

/** 在页面里执行一段 JS 并返回结果（Promise 自动等待）。超时只是放弃等待返回，无法中断页面里已卡死的脚本 */
export async function cdpEvaluate(args: { js: string; index?: number; timeout?: number }): Promise<EvalResult> {
  try {
    const js = args.js.trim()
    if (!js) return { ok: false, reason: 'js 不能为空' }
    if (js.length > 8000) return { ok: false, reason: `js 太长（${js.length} 字符，上限 8000）` }
    const browser = await getCdpBrowser()
    const page = await pickPage(browser, args.index)
    const timeout = Math.min(Math.max(args.timeout ?? 10000, 1000), 30000)
    const value = await Promise.race([
      page.evaluate(js),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`执行超时（${timeout}ms），脚本仍在页面里运行，请避免死循环`)), timeout),
      ),
    ])
    let result: string
    if (value === undefined) {
      result = '(无返回值)'
    } else {
      try {
        result = typeof value === 'string' ? value : JSON.stringify(value)
      } catch {
        result = String(value)
      }
    }
    if (result.length > 4000) result = `${result.slice(0, 4000)}…（共 ${result.length} 字符，已截断）`
    return { ok: true, result }
  } catch (e) {
    return { ok: false, reason: cdpError(e) }
  }
}

export interface TypeResult {
  ok: boolean
  reason?: string
}

export async function cdpType(args: { selector?: string; text: string; index?: number }): Promise<TypeResult> {
  try {
    const browser = await getCdpBrowser()
    const page = await pickPage(browser, args.index)
    const loc = args.selector?.trim()
      ? page.locator(args.selector).first()
      : page.locator('input, textarea, [contenteditable="true"]').first()
    if ((await loc.count()) === 0) return { ok: false, reason: '找不到输入框（不传 selector 时用第一个 input/textarea）' }
    await loc.click({ timeout: 3000 })
    await loc.fill(args.text)
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: cdpError(e) }
  }
}
