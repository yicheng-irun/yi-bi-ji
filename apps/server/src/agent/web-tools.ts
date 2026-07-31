import { tool } from 'ai'
import { z } from 'zod'
import { fetchWebPage, searchWeb } from '../services/browser.js'

export function createWebTools() {
  return {
    web_search: tool({
      description: '在互联网上搜索资料、新闻。返回标题、链接、摘要。找到相关结果后用 web_fetch 打开链接读取全文。',
      inputSchema: z.object({
        query: z.string().describe('搜索关键词，用中文或英文均可'),
        maxResults: z.coerce.number().optional().describe('最多返回几条结果，默认 8'),
      }),
      execute: async ({ query, maxResults }) => searchWeb(query, maxResults ?? 8),
    }),

    web_fetch: tool({
      description:
        '用浏览器打开一个网页并提取正文（可绕过很多反爬限制）。HTML 页面默认返回 Markdown（保留链接、图片地址、标题层级，链接已转绝对地址），适合直接引用进笔记；JSON/纯文本/XML 等接口响应直接返回原始内容（JSON 会格式化）。内容较长时返回前 maxChars 字符和总长度 totalChars，可用 start 参数翻页继续读。失败会返回原因（超时、真人验证、二进制内容等）。',
      inputSchema: z.object({
        url: z.string().describe('要打开的网页 URL'),
        format: z
          .enum(['markdown', 'text'])
          .optional()
          .describe('输出格式：markdown 保留链接/图片（默认），text 纯文本'),
        start: z.coerce.number().optional().describe('从第几个字符开始读（用于长文翻页），默认 0'),
        maxChars: z.coerce.number().optional().describe('本次最多读取多少字符，默认 8000'),
      }),
      execute: async ({ url, format, start, maxChars }) =>
        fetchWebPage(url, start ?? 0, maxChars ?? 8000, format ?? 'markdown'),
    }),
  }
}

export type WebTools = ReturnType<typeof createWebTools>
