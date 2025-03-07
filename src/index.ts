
import { Hono } from 'hono'
import { Env } from "../worker-configuration";
import { cors } from 'hono/cors'
import { getCookie, setCookie } from "hono/cookie";

import chat from './routes/chat';
import knowledgebase from './routes/knowledgebase';

// Hono c variables
type Variables = {
  userId: string;
};

const app = new Hono<{ Bindings: Env, Variables: Variables }>()

app.use('*', cors())

// Middleware
// Add a session cookie to all requests if not exist
app.use("/chat", async (ctx, next) => {
  let userId = getCookie(ctx, "userId");
  console.log('userId:', userId, new Date());

  const resetChat = ctx.req.query('reset')
  console.log('Chat Reset:', resetChat);

  if (!userId || resetChat==='yes') {
    userId = "anon-" + crypto.randomUUID();
    console.log("New cookie:", userId, new Date());
    const maxAge = 1200000;
    setCookie(ctx, "userId", userId, {
      path: '/chat',
      secure: false,
      httpOnly: true,
      expires: new Date(Date.now() + maxAge)
    });
  }
  ctx.set("userId", userId);
  await next();
});

// Define routes
app.route('/chat', chat)
app.route('/knowledgebase', knowledgebase)


// This endpoint is for cron job initialized endpoint
app.get('/cron-test', (ctx) => {
  return ctx.text('Cron job running now!')
})

async function handleScheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {

  console.log('Scheduled time: ', new Date(event.scheduledTime));

  // const response = await app.request('/cron-test')
  

  // // Log the response from the /cron endpoint
  // console.log('Cron Test endpoint response:', await response.text())
}

export default {
  fetch: app.fetch,
  scheduled: handleScheduled
}