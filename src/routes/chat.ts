import { Hono } from 'hono'
import { html, raw } from 'hono/html'
import { Env } from "../../worker-configuration";

const app = new Hono<{ Bindings: Env }>()
// This endpoint is used to test the server

app.get('/', (ctx) => {
  return ctx.html(html`
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Chat UI</title>
        <!-- Add HTMX -->
        <script src="https://unpkg.com/htmx.org@1.9.10"></script>
        <script src="https://unpkg.com/htmx.org/dist/ext/json-enc.js"></script>

        <style>
            body {
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                font-family: Arial, sans-serif;
            }
            #chat-container {
                height: 400px;
                border: 1px solid #ccc;
                overflow-y: auto;
                padding: 20px;
                margin-bottom: 20px;
            }
            .message {
                margin: 10px 0;
                padding: 10px;
                border-radius: 5px;
            }
            .user-message {
                background-color: #e3f2fd;
                margin-left: 20%;
            }
            .bot-message {
                background-color: #f5f5f5;
                margin-right: 20%;
            }
            #message {
                flex: 1;
                padding: 10px;
            }
            #submit-btn {
                padding: 10px;
                background-color: #007bff;
                color: white;
                border: none;
                cursor: pointer;
            }
        </style>
    </head>
    <body>
        <div id="chat-container" 
            hx-get="/messages" 
            hx-trigger="load, newMessage from:body"
            hx-swap="innerHTML">
        </div>

        <form hx-post="/ai/chat" 
              hx-trigger="submit"
              hx-target="#chat-container"
              hx-swap="beforeend"
              hx-ext="json-enc"
            >
            <input type="text" 
                  id="message"
                  name="message" 
                  placeholder="Type your message..."
                  required>
            <button id="submit-btn" type="submit">Send</button>
        </form>
    </body>
    </html>
    `);

})

export default app;