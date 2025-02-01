import { Ai } from '@cloudflare/workers-types';
interface Env {
  ENVIRONMENT: "dev" | "staging" | "production";
  VECTORIZE: VectorizeIndex;
  AI: Ai;
}
interface EmbeddingResponse {
  shape: number[];
  data: number[][];
}

interface LLMResponse {
  response: string;
  usage: {
    prompt_tokens: number,
    completion_tokens: number,
    total_tokens: number
  }
}

import {
  CloudflareVectorizeStore,
  CloudflareWorkersAIEmbeddings
} from "@langchain/cloudflare";
import { VectorizeIndex } from "@cloudflare/workers-types";
import { Hono } from 'hono'
import { stream } from 'hono/streaming';

const app = new Hono<{ Bindings: Env }>()

// function vectorStore(env: Env) {
//   const embeddings = new CloudflareWorkersAIEmbeddings({
//     binding: env.AI,
//     model: "@cf/baai/bge-base-en-v1.5",
//   });

//   const store = new CloudflareVectorizeStore(embeddings, {
//     index: env.VECTORIZE,
//   });

//   return store;
// }

async function queryVector(env: Env, message: string, topKwrgs: number = 1) {
  const embeddings: EmbeddingResponse = await env.AI.run(
    "@cf/baai/bge-base-en-v1.5",
    {
      text: message,
    },
  );
  const vectors = embeddings.data[0];
  let vectorQuery = await env.VECTORIZE.query(vectors, { topK: topKwrgs });
  let vecId;
  console.log("Query Result:", vectorQuery);

  if (vectorQuery.matches && vectorQuery.matches.length > 0 && vectorQuery.matches[0] && vectorQuery.matches[0].score > 0.75) {
    vecId = vectorQuery.matches[0].id;
  } else {
    console.log("No matching vector found");
  }

  return vecId;
}

// This endpoint is used to test the server
app.get('/', (ctx) => {
  return ctx.text('Hello Hono v2! in ' + ctx.env.ENVIRONMENT)
})

// This endpoint is used to ask questions to the AI
app.post('/ai', async (ctx) => {
  const body = await ctx.req.json();
  const question = body.user.message;
  console.log('question:', question);

  const results = await queryVector(ctx.env, question, 1);

  let docs: string[] = []
  console.log('Vector Results:', results);

  const contextMessage = docs.length
    ? `Context:\n${docs.map(doc => `- ${doc}`).join("\n")}`
    : ""
  const systemPrompt = `When answering the question or responding, use the context provided, if it is provided and relevant. Try to answer in 50 words and dont mention the context and give consize answer`

  const response = await ctx.env.AI.run(
    '@cf/meta/llama-3-8b-instruct',
    {
      messages: [
        ...(docs.length ? [{ role: 'system', content: contextMessage }] : []),
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      stream: false,
    }
  );

  console.log('response:', response);
  // console.log('usage:', usage);
  
  const answer = response
  return ctx.json(answer);
})


app.post("/ai/load", async (ctx) => {
  const embeddings = new CloudflareWorkersAIEmbeddings({
    binding: ctx.env.AI,
    model: "@cf/baai/bge-base-en-v1.5",
  });

  const store = new CloudflareVectorizeStore(embeddings, {
    index: ctx.env.VECTORIZE,
  });

  const documents = [
    { pageContent: "hello", metadata: {} },
    { pageContent: "world", metadata: {} },
    { pageContent: "hi", metadata: {} }
  ];

  await store.addDocuments(documents, {
    ids: ["id1", "id2", "id3"]
  });

  return ctx.json({ success: true });
});


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