
import { Hono } from 'hono'
import { Env } from "../worker-configuration";
import { cors } from 'hono/cors'

import chat from './routes/chat';
import ui from './routes/ui';
import vectordb from './routes/vectordb';

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors())

// Define routes
app.route('/chat', chat)
app.route('/ui', ui)
app.route('/vectordb', vectordb)


// This endpoint is for cron job initialized endpoint
app.get('/cron-test', (ctx) => {
  return ctx.text('Cron job running now!')
})

async function handleScheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {

  console.log('Scheduled time: ', new Date(event.scheduledTime));

  // Create a new request to the /cron endpoint
  const request = new Request('http://localhost/cron-test')
  const response = await app.fetch(request, env)

  // Log the response from the /cron endpoint
  console.log('Cron Test endpoint response:', await response.text())
}

export default {
  fetch: app.fetch,
  scheduled: handleScheduled
}