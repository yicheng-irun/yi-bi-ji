import { spawn, type ChildProcess } from 'node:child_process'
import { OpenCodeClient } from './opencode-client.js'

export interface ServeManagerOptions {
  bin: string
  port: number
  hostname: string
  projectDir: string
  username?: string
  password?: string
  /** 外部已有 serve 地址；设置后不再 spawn */
  externalUrl?: string
}

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000]
const HEALTH_TIMEOUT_MS = 45000

/**
 * opencode serve 子进程托管：spawn / 健康检查 / 崩溃重启（退避）/ 退出清理。
 * 若配置了 externalUrl，则不做托管，直接使用外部 serve。
 */
export class ServeManager {
  private child: ChildProcess | null = null
  private restartDelayMs = RETRY_DELAYS_MS[0]
  private shutdown = false
  private healthTimer: ReturnType<typeof setTimeout> | null = null
  readonly baseURL: string
  readonly client: OpenCodeClient

  constructor(private opts: ServeManagerOptions) {
    this.baseURL = opts.externalUrl ? opts.externalUrl : `http://${opts.hostname}:${opts.port}`
    this.client = new OpenCodeClient({
      baseURL: this.baseURL,
      username: opts.username,
      password: opts.password,
    })
  }

  get external(): boolean {
    return !!this.opts.externalUrl
  }

  /** 启动（或使用外部 serve），等待健康检查就绪后 resolve */
  async start(): Promise<void> {
    if (this.external) {
      await this.waitHealthy(this.opts.externalUrl!)
      console.log(`[opencode-mcp] 使用外部 opencode serve: ${this.baseURL}`)
      return
    }
    this.spawn()
    await this.waitHealthy(this.baseURL)
  }

  private spawn() {
    if (this.shutdown) return
    const { bin, port, hostname, projectDir, password } = this.opts
    console.log(`[opencode-mcp] spawn opencode serve --port ${port} --hostname ${hostname} (cwd: ${projectDir})`)
    const child = spawn(bin, ['serve', '--port', String(port), '--hostname', hostname], {
      cwd: projectDir,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: {
        ...process.env,
        ...(password ? { OPENCODE_SERVER_PASSWORD: password } : {}),
      },
    })
    this.child = child
    child.on('exit', (code, signal) => {
      this.child = null
      if (this.shutdown) return
      if (code !== 0) {
        console.error(`[opencode-mcp] opencode serve 退出 (code=${code}, signal=${signal})，${this.restartDelayMs}ms 后重启`)
        this.healthTimer = setTimeout(() => {
          this.restartDelayMs = RETRY_DELAYS_MS[Math.min(RETRY_DELAYS_MS.indexOf(this.restartDelayMs) + 1, RETRY_DELAYS_MS.length - 1)]
          this.spawn()
        }, this.restartDelayMs)
      }
    })
    child.on('error', (err) => {
      console.error(`[opencode-mcp] spawn opencode serve 失败: ${err.message}`)
    })
  }

  private async waitHealthy(url: string, timeoutMs = HEALTH_TIMEOUT_MS): Promise<void> {
    const client = new OpenCodeClient({
      baseURL: url,
      username: this.opts.username,
      password: this.opts.password,
      timeoutMs: 3000,
    })
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const health = await client.health()
        if (health.healthy) {
          console.log(`[opencode-mcp] opencode serve 就绪 (version ${health.version})`)
          return
        }
        console.log(`[opencode-mcp] serve health 异常: ${JSON.stringify(health)}`)
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    throw new Error(`opencode serve 在 ${timeoutMs}ms 内未就绪: ${url}`)
  }

  /** 进程退出时清理：kill 子进程、清定时器。子进程不退出时最多等 3s 后强杀 */
  async dispose(): Promise<void> {
    this.shutdown = true
    if (this.healthTimer) {
      clearTimeout(this.healthTimer)
      this.healthTimer = null
    }
    if (this.child?.pid) {
      const pid = this.child.pid
      try {
        process.kill(pid, 'SIGTERM')
      } catch {
        this.child?.kill('SIGTERM')
      }
      const exited = await Promise.race([
        new Promise<boolean>((r) => {
          this.child?.once('exit', () => r(true))
          this.child?.once('error', () => r(false))
        }),
        new Promise<boolean>((r) => setTimeout(() => r(false), 3000)),
      ])
      if (!exited) {
        try {
          process.kill(pid, 'SIGKILL')
        } catch {
          this.child?.kill('SIGKILL')
        }
      }
      this.child = null
    }
  }
}
