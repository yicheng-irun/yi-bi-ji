import { createNoteTools } from '../src/agent/tools.js'
const tools = createNoteTools('test-thread')
const deep = tools.deep_research as any
let last: any
try {
  for await (const message of deep.execute({ task: '介绍下杭州的湖滨银泰in77' }, { abortSignal: new AbortController().signal })) {
    last = message
  }
} catch (err: any) {
  console.error('execute failed:', err?.message ?? String(err))
}
const modelOut = await deep.toModelOutput({ toolCallId: 'x', input: { task: '' }, output: last })
console.log('toModelOutput:', JSON.stringify(modelOut))
console.log('value length:', modelOut?.value?.length)
console.log('has links?', /https?:\/\//.test(modelOut?.value ?? ''))
