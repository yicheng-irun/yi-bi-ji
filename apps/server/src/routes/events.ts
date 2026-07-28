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
    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        bus.off('event', listener)
        resolve()
      })
    })
  })
})
