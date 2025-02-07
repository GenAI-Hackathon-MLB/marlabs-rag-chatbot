import { Hono } from 'hono'
import { html, raw } from 'hono/html'
import { Env } from "../../worker-configuration";
// import {serveStatic} from '@hono'

const app = new Hono<{ Bindings: Env }>()
// This endpoint is used to test the server

app.get('*', (ctx) => {
    return ctx.text("ok")

})

export default app;