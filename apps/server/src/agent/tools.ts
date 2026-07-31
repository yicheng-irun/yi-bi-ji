import { tool } from 'ai'
import { z } from 'zod'
import { listNotes, searchNotes, readNote, createNote, aiWriteNote, aiReplaceInNote, aiInsertBlock, aiDeleteNote, updateNoteMeta } from '../services/notes.js'
import { fetchWebPage, searchWeb } from '../services/browser.js'

export function createNoteTools(threadId: string) {
  return {
    list_notes: tool({
      description: '列出库中所有笔记的 id、标题、更新时间。用于概览有哪些笔记。',
      inputSchema: z.object({}),
      execute: async () => {
        const notes = await listNotes()
        return notes.map((n) => ({ id: n.id, title: n.draftTitle, updatedAt: n.updatedAt }))
      },
    }),

    search_notes: tool({
      description: '按关键词在笔记标题和正文中搜索（LIKE 模糊匹配），返回匹配的笔记与片段。',
      inputSchema: z.object({
        query: z.string().describe('搜索关键词'),
        page: z.coerce.number().optional().describe('页码，从 1 开始'),
      }),
      execute: async ({ query, page }) => searchNotes(query, page ?? 1),
    }),

    read_note: tool({
      description: '读取一篇笔记的草稿内容，可用 startLine/endLine 只读取指定行范围（从 1 开始，含端点）。返回总行数。',
      inputSchema: z.object({
        noteId: z.coerce.number().describe('笔记 id'),
        startLine: z.coerce.number().optional().describe('起始行（含），默认 1'),
        endLine: z.coerce.number().optional().describe('结束行（含），默认到末尾'),
      }),
      execute: async ({ noteId, startLine, endLine }) => readNote(noteId, startLine, endLine),
    }),

    create_note: tool({
      description: '创建一篇新笔记（写入草稿，需用户确认后才会正式落库）。',
      inputSchema: z.object({
        title: z.string().describe('笔记标题'),
        content: z.string().describe('markdown 正文'),
        tags: z.array(z.string()).optional().describe('标签，0~5 个自由关键词，如：资讯、随想、稿子、计划、方法论、提示词'),
      }),
      execute: async ({ title, content, tags }) => {
        const note = await createNote({ title, content, tags }, 'ai', threadId)
        return { ok: true, noteId: note.id, title: note.draftTitle }
      },
    }),

    set_note_tags: tool({
      description: '设置一篇笔记的标签（整体替换）。标签是自由关键词，用于整理、归类笔记；先用 list_notes 看看已有标签名，尽量复用保持一致。',
      inputSchema: z.object({
        noteId: z.coerce.number().describe('笔记 id'),
        tags: z.array(z.string()).describe('新的标签列表（整体替换，传空数组表示清空）'),
      }),
      execute: async ({ noteId, tags }) => {
        const note = await updateNoteMeta(noteId, { tags })
        return { ok: true, tags: note.tags }
      },
    }),

    write_note: tool({
      description: '全量覆盖一篇笔记的草稿内容（短期由 AI 直接覆盖并更新版本号）。原草稿会记录到变更日志。',
      inputSchema: z.object({
        noteId: z.coerce.number().describe('笔记 id'),
        content: z.string().describe('新的完整 markdown 正文'),
      }),
      execute: async ({ noteId, content }) => {
        const note = await aiWriteNote(noteId, content, threadId)
        return { ok: true, noteId: note.id, draftContentVersion: note.draftContentVersion }
      },
    }),

    replace_in_note: tool({
      description:
        '在笔记草稿中做字符串替换：把 old_string 替换为 new_string。old_string 必须在草稿中唯一出现，否则报错；失败时请先用 read_note 重新读取内容再重试。',
      inputSchema: z.object({
        noteId: z.coerce.number().describe('笔记 id'),
        old_string: z.string().describe('要被替换的原文（需在文中唯一）'),
        new_string: z.string().describe('替换后的文本'),
      }),
      execute: async ({ noteId, old_string, new_string }) => {
        const result = await aiReplaceInNote(noteId, old_string, new_string, threadId)
        if (!result.ok) return { ok: false, reason: result.reason }
        return { ok: true, draftContentVersion: result.note.draftContentVersion }
      },
    }),

    insert_block: tool({
      description:
        '在笔记草稿中锚点插入一个 markdown 区块。anchor 三选一：end（文末追加）、after_heading（在包含指定文字的标题行后追加）、after_text（在指定文本后追加）。',
      inputSchema: z.object({
        noteId: z.coerce.number().describe('笔记 id'),
        block: z.string().describe('要插入的 markdown 区块'),
        anchor: z
          .union([
            z.object({ type: z.literal('end') }),
            z.object({ type: z.literal('after_heading'), heading: z.string().describe('标题中包含的文字') }),
            z.object({ type: z.literal('after_text'), text: z.string().describe('锚点文本') }),
          ])
          .describe('插入位置锚点'),
      }),
      execute: async ({ noteId, block, anchor }) => {
        const result = await aiInsertBlock(noteId, block, anchor, threadId)
        if (!result.ok) return { ok: false, reason: result.reason }
        return { ok: true, draftContentVersion: result.note.draftContentVersion }
      },
    }),

    delete_note: tool({
      description: '删除一篇笔记。已有被标记删除的笔记时不可重复删除。',
      inputSchema: z.object({
        noteId: z.coerce.number().describe('要删除的笔记 id'),
      }),
      execute: async ({ noteId }) => {
        const result = await aiDeleteNote(noteId, threadId)
        return { ok: true, noteId: result.noteId, title: result.title }
      },
    }),

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

export type NoteTools = ReturnType<typeof createNoteTools>
