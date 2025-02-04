
import { Hono } from 'hono'
import { Env } from "../worker-configuration";
import ai from './routes/ai';
import chat from './routes/chat';
import vectordb from './routes/vectordb';

import { cors } from 'hono/cors'

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors())

// Define routes
app.route('/ai', ai)
app.route('/chat', chat)
app.route('/vectordb', vectordb)


// This endpoint is for cron job initialized endpoint
app.get('/cron', (ctx) => {
  return ctx.text('Cron job running now!')
})

async function handleScheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {

  console.log('Scheduled time: ', new Date(event.scheduledTime));

  // Create a new request to the /cron endpoint
  const request = new Request('http://localhost/cron')
  const response = await app.fetch(request, env)

  // Log the response from the /cron endpoint
  console.log('Cron endpoint response:', await response.text())
}

export default {
  fetch: app.fetch,
  scheduled: handleScheduled
}