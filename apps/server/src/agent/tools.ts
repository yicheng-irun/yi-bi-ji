import { readUIMessageStream, toUIMessageStream, tool, type ToolSet, type UIMessage } from 'ai'
import { z } from 'zod'
import { ChatThread } from '../db/models.js'
import { listNotes, searchNotes, readNote, createNote, aiWriteNote, aiReplaceInNote, aiInsertBlock, aiDeleteNote, updateNoteMeta } from '../services/notes.js'
import { persistMessages } from '../services/chat.js'
import { getSettings } from '../services/settings.js'
import { createWebTools } from './web-tools.js'
import { createBrowserTools } from './browser-tools.js'
import { createResearchSubagent } from './subagents.js'/** 主代理全部可用工具（含联网与深度调研） */
export const MAIN_AGENT_TOOLS = [
  'web_search', 'web_fetch', 'deep_research',
  'browser_tabs', 'browser_read', 'browser_screenshot', 'browser_navigate', 'browser_click', 'browser_type',
  'list_notes', 'search_notes', 'read_note', 'create_note', 'set_note_tags',
  'write_note', 'replace_in_note', 'insert_block', 'delete_note',
] as const

/** 调研子代理全部可用工具（不含 deep_research，避免递归） */
export const SUBAGENT_TOOLS = MAIN_AGENT_TOOLS.filter((n) => n !== 'deep_research')

export const ALL_TOOLS_SENTINEL = '*'

/** 解析设置里的工具列表字符串：'*' / 未配置 → null（全部可用）；'' → 空集合（全部禁用）；否则返回启用集合 */
export function parseEnabledTools(raw: string | undefined | null): Set<string> | null {
  if (raw == null || raw === ALL_TOOLS_SENTINEL) return null
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))
}

function pickTools<T extends Record<string, unknown>>(all: T, enabled: Set<string> | null): T {
  if (!enabled) return all
  return Object.fromEntries(Object.entries(all).filter(([name]) => enabled.has(name))) as T
}

/** 工具返回值必须为纯 JSON（AI SDK 会做 Zod 校验），把 Date 转成 ISO 字符串，避免校验失败 */
function toJsonSafe(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(toJsonSafe)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = toJsonSafe(v)
    return out
  }
  return value
}

export function createNoteTools(
  threadId: string,
  enabledTools: Set<string> | null = null,
  subagentEnabledTools: Set<string> | null = null,
  mcpTools: ToolSet = {},
) {
  const s = getSettings()
  const browserToolsEnabled = s.browserCdpEnabled === '1' && !!s.browserCdpUrl?.trim()
  const tools = {
    ...createWebTools(),
    ...(browserToolsEnabled ? createBrowserTools() : {}),

    deep_research: tool({
      description:
        '联网深度调研一个主题或问题：派出一个独立的联网研究子代理，它会自主搜索、读文，必要时直接读写笔记，最终返回带来源链接的结构化报告。适合需要翻阅大量网页、深度对比资料的场景；简单查一条信息用 web_search 即可。',
      inputSchema: z.object({
        task: z.string().describe('要调研的问题或主题，尽量具体（含目标、需要回答的子问题、关注维度）'),
      }),
      execute: async function* ({ task }, { abortSignal }) {
        const subThreadId = crypto.randomUUID()
        const title = `深度调研：${task.replace(/\s+/g, ' ').trim().slice(0, 30)}`
        await ChatThread.create({
          id: subThreadId,
          title,
          metadata: JSON.stringify({
            parentThreadId: threadId,
            kind: 'subagent',
            subagentId: 'research-subagent',
          }),
        })

        const { deep_research: _exclude, ...subagentTools } = createNoteTools(subThreadId, subagentEnabledTools, null, mcpTools)
        const subagent = createResearchSubagent(subagentTools)
        const result = await subagent.stream({ prompt: task, abortSignal })

        const userMessage: UIMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          parts: [{ type: 'text', text: task }],
        }
        const collected = new Map<string, UIMessage>([[userMessage.id, userMessage]])

        try {
          for await (const message of readUIMessageStream({
            stream: toUIMessageStream({ stream: result.stream, tools: subagent.tools }),
          })) {
            collected.set(message.id, message)
            yield message
          }
        } finally {
          if (!abortSignal?.aborted) {
            await persistMessages(subThreadId, [...collected.values()]).catch((err) =>
              console.error('persist subagent messages failed', err),
            )
          }
        }
      },
      toModelOutput: ({ output }) => {
        const message = output as { parts?: Array<{ type: string; text?: string }> | undefined } | undefined
        let summary = ''
        for (let i = (message?.parts?.length ?? 0) - 1; i >= 0; i--) {
          const p = message?.parts?.[i]
          if (p?.type === 'text' && p.text) {
            summary = p.text
            break
          }
        }
        return { type: 'text', value: summary || '子代理已完成研究任务。' }
      },
    }),

    list_notes: tool({
      description: '列出库中所有笔记的 id、标题、更新时间。用于概览有哪些笔记。',
      inputSchema: z.object({}),
      execute: async () => {
        const notes = await listNotes()
        return toJsonSafe(notes.map((n) => ({ id: n.id, title: n.draftTitle, updatedAt: n.updatedAt })))
      },
    }),

    search_notes: tool({
      description: '按关键词在笔记标题和正文中搜索（LIKE 模糊匹配），返回匹配的笔记与片段。',
      inputSchema: z.object({
        query: z.string().describe('搜索关键词'),
        page: z.coerce.number().optional().describe('页码，从 1 开始'),
      }),
      execute: async ({ query, page }) => toJsonSafe(await searchNotes(query, page ?? 1)),
    }),

    read_note: tool({
      description: '读取一篇笔记的草稿内容，可用 startLine/endLine 只读取指定行范围（从 1 开始，含端点）。返回总行数。',
      inputSchema: z.object({
        noteId: z.coerce.number().describe('笔记 id'),
        startLine: z.coerce.number().optional().describe('起始行（含），默认 1'),
        endLine: z.coerce.number().optional().describe('结束行（含），默认到末尾'),
      }),
      execute: async ({ noteId, startLine, endLine }) => toJsonSafe(await readNote(noteId, startLine, endLine)),
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
        const note = await updateNoteMeta(noteId, { tags }, { threadId })
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
  }

  return { ...pickTools(tools, enabledTools), ...mcpTools }
}

export type NoteTools = ReturnType<typeof createNoteTools>