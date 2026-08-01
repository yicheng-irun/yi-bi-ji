import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  linkStyle: 'inlined',
})
turndown.use(gfm)

/** 把 HTML 里的相对链接/图片地址转成绝对地址（相对 baseUrl 解析） */
export function absolutizeLinks(html: string, baseUrl: string): string {
  try {
    const { document } = parseHTML(html)
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href')
      if (href) a.setAttribute('href', new URL(href, baseUrl).href)
    }
    for (const img of document.querySelectorAll('img[src]')) {
      const src = img.getAttribute('src')
      if (src) img.setAttribute('src', new URL(src, baseUrl).href)
    }
    return document.toString()
  } catch {
    return html
  }
}

export interface ExtractedContent {
  /** 文章标题（可能是空串） */
  title: string
  /** 纯文本正文 */
  text: string
  /** Markdown 正文（保留链接/图片，可能为空串） */
  markdown: string
}

/** 用 Readability + Turndown 从 HTML 提取正文；失败时返回空内容由调用方兜底 */
export function extractPageContent(html: string, baseUrl: string): ExtractedContent {
  let text = ''
  let markdown = ''
  let title = ''
  try {
    const { document } = parseHTML(html)
    const article = new Readability(document).parse()
    if (article?.textContent) {
      text = article.textContent
      title = article.title ?? ''
      if (article.content) {
        markdown = turndown.turndown(absolutizeLinks(article.content, baseUrl))
      }
    }
  } catch {
    // fall through to empty content
  }
  return { title, text, markdown }
}

/** 规范化正文：合并多余空行、去掉行尾空白 */
export function normalizeText(s: string): string {
  return s.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+$/gm, '').trim()
}
