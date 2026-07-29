import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import type { Browser } from 'playwright'

chromium.use(StealthPlugin())

let browserPromise: Promise<Browser> | null = null

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
    })
    const b = await browserPromise
    b.on('disconnected', () => {
      browserPromise = null
    })
  }
  return browserPromise
}

const CHALLENGE_PATTERNS = [
  'just a moment',
  'attention required',
  'checking your browser',
  'verify you are human',
  'are you a robot',
]

function looksLikeChallenge(title: string, text: string) {
  const probe = (title + ' ' + text.slice(0, 500)).toLowerCase()
  return CHALLENGE_PATTERNS.some((p) => probe.includes(p))
}

export interface FetchResult {
  ok: boolean
  url: string
  title?: string
  totalChars?: number
  start?: number
  content?: string
  reason?: string
}

export async function fetchWebPage(url: string, start = 0, maxChars = 8000): Promise<FetchResult> {
  let parsed: URL
  try {
    parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { ok: false, url, reason: '只支持 http/https 链接' }
    }
  } catch {
    return { ok: false, url, reason: 'URL 格式不正确' }
  }

  const browser = await getBrowser()
  const context = await browser.newContext({
    locale: 'zh-CN',
    viewport: { width: 1366, height: 900 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    if (!response) return { ok: false, url, reason: '页面无响应' }
    const status = response.status()
    if (status >= 400) return { ok: false, url, reason: `HTTP ${status}` }

    const contentType = response.headers()['content-type'] ?? ''
    if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return { ok: false, url, reason: `不是网页内容（${contentType.split(';')[0]}），无法提取正文` }
    }

    await page.waitForTimeout(2000)

    let title = await page.title()
    let bodyText = await page.evaluate(() => document.body?.innerText ?? '')
    if (looksLikeChallenge(title, bodyText)) {
      await page.waitForTimeout(8000)
      title = await page.title()
      bodyText = await page.evaluate(() => document.body?.innerText ?? '')
      if (looksLikeChallenge(title, bodyText)) {
        return { ok: false, url, reason: '触发了站点的真人验证（如 Cloudflare），暂时无法通过' }
      }
    }

    const html = await page.content()
    let text = ''
    let articleTitle = title
    try {
      const { document } = parseHTML(html)
      const article = new Readability(document).parse()
      if (article?.textContent) {
        text = article.textContent
        articleTitle = article.title || title
      }
    } catch {
      // fall through to body text
    }
    if (!text.trim()) text = bodyText
    text = text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim()
    if (!text) return { ok: false, url, reason: '页面没有可提取的文本内容' }

    const s = Math.max(0, start)
    return {
      ok: true,
      url: page.url(),
      title: articleTitle,
      totalChars: text.length,
      start: s,
      content: text.slice(s, s + maxChars),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('Timeout')) return { ok: false, url, reason: '页面加载超时（30s）' }
    return { ok: false, url, reason: `打开页面失败：${message.slice(0, 200)}` }
  } finally {
    await context.close().catch(() => {})
  }
}

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

const ENGINES: Array<{ name: string; url: (q: string) => string; extract: (limit: number) => SearchResult[] }> = [
  {
    name: 'bing',
    url: (q) => 'https://cn.bing.com/search?q=' + encodeURIComponent(q),
    extract: (limit) => {
      const out: SearchResult[] = []
      for (const el of document.querySelectorAll('li.b_algo')) {
        const a = el.querySelector<HTMLAnchorElement>('h2 a')
        if (!a || !a.href.startsWith('http')) continue
        const snippet = el.querySelector('.b_caption p')?.textContent?.trim() ?? ''
        out.push({ title: a.textContent?.trim() ?? '', url: a.href, snippet })
        if (out.length >= limit) break
      }
      return out
    },
  },
  {
    name: 'baidu',
    url: (q) => 'https://www.baidu.com/s?wd=' + encodeURIComponent(q),
    extract: (limit) => {
      const out: SearchResult[] = []
      for (const el of document.querySelectorAll('div.result, div[tpl="se_com_default"]')) {
        const a = el.querySelector<HTMLAnchorElement>('h3 a')
        if (!a || !a.href.startsWith('http')) continue
        const snippet = el.querySelector('.c-abstract, [class*="content-right"]')?.textContent?.trim() ?? ''
        out.push({ title: a.textContent?.trim() ?? '', url: a.href, snippet })
        if (out.length >= limit) break
      }
      return out
    },
  },
]

export async function searchWeb(query: string, maxResults = 8): Promise<{ ok: boolean; results: SearchResult[]; reason?: string }> {
  const browser = await getBrowser()
  const errors: string[] = []
  for (const engine of ENGINES) {
    const context = await browser.newContext({ locale: 'zh-CN' })
    const page = await context.newPage()
    try {
      await page.goto(engine.url(query), { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(1500)
      const results = await page.evaluate(engine.extract, maxResults)
      if (results.length > 0) return { ok: true, results }
      errors.push(`${engine.name}: 无结果`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`${engine.name}: ${message.slice(0, 120)}`)
    } finally {
      await context.close().catch(() => {})
    }
  }
  return { ok: false, results: [], reason: '搜索失败（' + errors.join('；') + '），可稍后重试' }
}

export async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null)
    browserPromise = null
    await b?.close().catch(() => {})
  }
}
