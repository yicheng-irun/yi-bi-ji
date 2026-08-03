import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

export const env = {
  port: Number(process.env.PORT ?? 15201),
  aiBaseURL: process.env.AI_BASE_URL ?? 'https://api.openai.com/v1',
  aiApiKey: process.env.AI_API_KEY ?? '',
  aiModel: process.env.AI_MODEL ?? 'gpt-4o-mini',
  dataDir: path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), 'data')),
  browserHeadless: process.env.BROWSER_HEADLESS !== 'false' && process.env.BROWSER_HEADLESS !== '0',
  browserCdpUrl: process.env.BROWSER_CDP_URL ?? '',
  voiceWorkspaceId: process.env.WORKSPACE_ID ?? '',
}
