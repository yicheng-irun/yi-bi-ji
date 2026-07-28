import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { env } from './env.js'
import { initDb } from './db/index.js'
import { notesRoutes, noteErrorHandler } from './routes/notes.js'
import { changesRoutes } from './routes/changes.js'
import { chatRoutes } from './routes/chat.js'
import { eventsRoutes } from './routes/events.js'

await initDb()

const app = new Hono()

app.use('*', cors())
app.onError(noteErrorHandler)

app.get('/api/health', (c) => c.json({ ok: true }))
app.route('/api/notes', notesRoutes)
app.route('/api/changes', changesRoutes)
app.route('/api/chat', chatRoutes)
app.route('/api/events', eventsRoutes)

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`server listening on http://localhost:${info.port}`)
})
