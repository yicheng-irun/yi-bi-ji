import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { bus, type BusEvent } from '../events/bus.js'

export const eventsRoutes = new Hono()

eventsRoutes.get('/', (c) => {
  return streamSSE(c, async (stream) => {
    const listener = (event: BusEvent) => {
      void stream.writeSSE({ event: event.type, data: JSON.stringify(event) }).catch(() => {})
    }
    bus.on('event', listener)
    // 心跳：防止代理/网关掐断空闲长连接，也让前端看门狗能识别半开连接
    const ping = setInterval(() => {
      void stream.writeSSE({ event: 'ping', data: '{}' }).catch(() => {})
    }, 15000)
    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        clearInterval(ping)
        bus.off('event', listener)
        resolve()
      })
    })
  })
})
