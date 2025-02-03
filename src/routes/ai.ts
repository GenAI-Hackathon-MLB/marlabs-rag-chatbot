
import { Hono } from 'hono'
import Groq from 'groq-sdk';
import { Env } from "../../worker-configuration";
import { streamText } from "hono/streaming";
import { queryVectorDB } from '../utils';


const app = new Hono<{ Bindings: Env }>()

// This function is used to query the vector store with a query
async function queryVector(env: Env, query: string, topKwrgs: number = 1) {
  // Get results from vector DB
  const results = await queryVectorDB(env, query, topKwrgs);

  // Attach context to system message
  const retrievedContext = results
    .filter(([document, score]) => score > 0.7)
    .map(([document, score]) => {
      return `${document.metadata?.name}: ${document.metadata?.text}`;
    })
    .join("\n\n");

  console.log('retrievedContext:', retrievedContext, new Date());
  return retrievedContext;
}

// This endpoint is used to ask querys to the AI with cloudflare models
app.post('/chat-stream', async (ctx) => {
  const payload = await ctx.req.json();
  console.log('payload:', payload, new Date());
  
  const query = payload.user.message;
  console.log('query:', query, new Date());

  const contextMessage = await queryVector(ctx.env, query, 1);
  // const results = "";

  const systemPrompt = `
    When answering the query or responding, use the context provided, 
    if it is provided and relevant. Try to answer in 50 words and dont 
    mention the context and give consize answer
  `;

  const groqClient = new Groq({
    apiKey: ctx.env.GROQ_API_KEY, // This is the default and can be omitted
  });

  const SystemMessage = systemPrompt + (contextMessage.length ? 'Context: ' + contextMessage : '')
  console.log('SystemMessage:', SystemMessage, new Date());
  
  const groqResponse = await groqClient.chat.completions.create({
    messages: [
      { role: 'system', content: SystemMessage },
      { role: 'user', content: query },
    ],
    model: ctx.env.LLM_MODEL,
    stream: true,
  });

  let response = groqResponse;
  console.log('response:', response, new Date());

  return streamText(ctx, async (stream) => {
    // const chunks = events(new Response(response as ReadableStream));
    for await (const chunk of groqResponse) {
      console.log('chunk:', chunk.choices[0].delta.content, new Date());

      if (chunk.choices[0].delta.content !== undefined && chunk.choices[0].delta.content !== "[DONE]") {
        if (chunk.choices[0].delta.content !== null) {
          stream.write(chunk.choices[0].delta.content);
        }
      }
    }
  });
})

// This endpoint is used to ask querys to the AI with cloudflare models
app.post('/chat', async (ctx) => {
  const payload = await ctx.req.json();
  console.log('payload:', payload, new Date());
  
  const query = payload.message;

  const contextMessage = await queryVector(ctx.env, query, 1);
  // const results = "";

  const systemPrompt = `
    When answering the query or responding, use the context provided, 
    if it is provided and relevant. Try to answer in 50 words and dont 
    mention the context and give consize answer
  `;

  const groqClient = new Groq({
    apiKey: ctx.env.GROQ_API_KEY, // This is the default and can be omitted
  });

  const SystemMessage = systemPrompt + (contextMessage.length ? 'Context: ' + contextMessage : '')
  console.log('SystemMessage:', SystemMessage, new Date());
  
  const groqResponse = await groqClient.chat.completions.create({
    messages: [
      { role: 'system', content: SystemMessage },
      { role: 'user', content: query },
    ],
    model: ctx.env.LLM_MODEL,
    stream: false,
  });

  let response = groqResponse;
  console.log('response:', response, new Date());

  return ctx.json(response.choices[0].message.content);
})

export default app;