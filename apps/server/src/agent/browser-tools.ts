import { tool } from 'ai'
import { z } from 'zod'
import { cdpClick, cdpType, listCdpTabs, navigateCdpPage, readCdpPage, screenshotCdpPage } from '../services/cdp.js'

const tabIndex = z.coerce
  .number()
  .int()
  .min(0)
  .optional()
  .describe('标签页序号（从 0 开始），不传则自动选当前活动页；先用 browser_tabs 查看')

/** 直接操作/读取用户本机已打开的真实浏览器（CDP）。适合读已登录、已过反爬验证的页面。 */
export function createBrowserTools() {
  return {
    browser_tabs: tool({
      description:
        '列出本机浏览器当前打开的所有标签页（标题+网址）。当用户说「你看我打开的网页」时，先用它确认要读哪个标签页（拿 index）。',
      inputSchema: z.object({}),
      execute: async () => listCdpTabs(),
    }),

    browser_read: tool({
      description:
        '读取本机浏览器当前活动标签页（或指定 index 标签页）的正文。直接读用户真实浏览器里已打开、已登录的页面，可绕过大多数反爬/登录验证，比 web_fetch 更可靠。HTML 页面默认返回 Markdown（保留链接和图片地址，链接已转绝对地址）；JSON/纯文本等接口响应直接返回原文。长文返回前 maxChars 字符和总长度 totalChars，用 start 翻页。失败返回原因（未连接浏览器、超时等）。',
      inputSchema: z.object({
        index: tabIndex,
        format: z.enum(['markdown', 'text']).optional().describe('markdown（默认，保留链接）或 text（纯文本）'),
        start: z.coerce.number().optional().describe('从第几个字符开始读（长文翻页），默认 0'),
        maxChars: z.coerce.number().optional().describe('本次最多读多少字符，默认 8000'),
      }),
      execute: async ({ index, format, start, maxChars }) =>
        readCdpPage(index, start ?? 0, maxChars ?? 8000, format ?? 'markdown'),
    }),

    browser_screenshot: tool({
      description:
        '对本机浏览器当前活动标签页截图，保存到笔记系统，返回可直接插入 markdown 笔记的图片链接（/api/screenshots/xxx.png）。适合把网页、表格、图表存档进笔记。',
      inputSchema: z.object({
        index: tabIndex,
        name: z.string().optional().describe('截图文件名前缀，默认 screenshot'),
        fullPage: z.coerce.boolean().optional().describe('是否整页截图，默认 false（只截当前可视区域）'),
      }),
      execute: async ({ index, name, fullPage }) => screenshotCdpPage(index, name, fullPage ?? false),
    }),

    browser_navigate: tool({
      description:
        '让本机浏览器当前活动标签页（或指定 index 标签页）跳转到指定 URL；newTab=true 时开新标签页。会真实改变用户浏览器，仅在用户明确要求操作浏览器时使用。',
      inputSchema: z.object({
        url: z.string().describe('要打开的 URL'),
        index: tabIndex,
        newTab: z.coerce.boolean().optional().describe('在新标签页打开，默认 false'),
      }),
      execute: async ({ url, index, newTab }) => navigateCdpPage(url, index, newTab ?? false),
    }),

    browser_click: tool({
      description:
        '在本机浏览器当前活动标签页点击一个元素。selector 填 CSS 选择器，text 填要点击的可见文本（模糊匹配），二者至少提供一个。点击会真实发生，可能触发跳转/弹窗，仅在用户明确要求时使用。',
      inputSchema: z.object({
        selector: z.string().optional().describe('CSS 选择器'),
        text: z.string().optional().describe('要点击的可见文本'),
        index: tabIndex,
      }),
      execute: async ({ selector, text, index }) => cdpClick({ selector, text, index }),
    }),

    browser_type: tool({
      description:
        '在本机浏览器当前活动标签页的输入框里输入文字（先清空再输入）。selector 填 CSS 选择器；不填则用页面第一个 input/textarea。',
      inputSchema: z.object({
        selector: z.string().optional().describe('CSS 选择器'),
        text: z.string().describe('要输入的文字'),
        index: tabIndex,
      }),
      execute: async ({ selector, text, index }) => cdpType({ selector, text, index }),
    }),
  }
}

export type BrowserTools = ReturnType<typeof createBrowserTools>
