import { getResults, startServer, stopServer } from './helpers.mts'
import { runNotesTests } from './notes.test.mts'
import { runDiffTests } from './diff.test.mts'
import { runEventsTests } from './events.test.mts'
import { runMcpTests } from './mcp.test.mts'
import { runChatTests } from './chat.test.mts'
import { runBrowserTests } from './browser.test.mts'

async function main() {
  try {
    await startServer()
    await runNotesTests()
    await runDiffTests()
    await runEventsTests()
    await runMcpTests()
    await runBrowserTests()
    await runChatTests()
  } finally {
    stopServer()
  }

  const { passed, failed } = getResults()
  console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  stopServer()
  process.exit(1)
})
