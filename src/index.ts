interface Env {
  ENVIRONMENT: string;
}

interface CloudflareBindings {
  ENVIRONMENT: string;
}

import { Hono } from 'hono'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.get('/', (ctx) => {  
  return ctx.text('Hello Hono v1! in ' + ctx.env.ENVIRONMENT)
})

app.get('/cron', (ctx) => {
  return ctx.text('Cron job running now!')
})

async function handleScheduled(event: ScheduledEvent, env: Env, ctx:ExecutionContext) {
  console.log('Scheduled event trigerred at', new Date().toISOString())
  console.log('Event:', event);
  
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