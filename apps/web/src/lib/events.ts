/**
 * 订阅 /api/events 全局 SSE。服务端每 15s 发 ping 心跳；
 * 看门狗检测半开连接（梯子/代理掐断后 TCP 不会立刻报错）：超过 45s 没有任何消息就主动重连。
 * 返回取消订阅函数。
 */
export function createEventStream(handlers: Record<string, (e: MessageEvent) => void>): () => void {
  let es: EventSource | null = null
  let lastMsg = Date.now()

  const connect = () => {
    const s = new EventSource('/api/events')
    es = s
    s.onopen = () => { lastMsg = Date.now() }
    s.addEventListener('ping', () => { lastMsg = Date.now() })
    for (const [type, fn] of Object.entries(handlers)) {
      s.addEventListener(type, (e) => {
        lastMsg = Date.now()
        fn(e as MessageEvent)
      })
    }
  }
  connect()

  const watchdog = setInterval(() => {
    if (Date.now() - lastMsg > 45000) {
      es?.close()
      connect()
    }
  }, 10000)

  return () => {
    clearInterval(watchdog)
    es?.close()
  }
}
