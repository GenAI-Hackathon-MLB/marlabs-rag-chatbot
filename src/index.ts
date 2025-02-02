
import {
  CloudflareVectorizeStore,
  CloudflareWorkersAIEmbeddings
} from "@langchain/cloudflare";
import { Hono } from 'hono'
import Groq from 'groq-sdk';
import { Env } from "../worker-configuration";
import { streamText } from "hono/streaming";

const LLM_MODEL = 'llama3-8b-8192';
const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";

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
  const embeddingResults = await env.AI.run(EMBEDDING_MODEL, { text: [message], });

  // Query Vector DB for similar documents
  let matches = await env.VECTORIZE.query(embeddingResults.data[0], {
    topK: topKwrgs, returnMetadata: "all",
  });

  // Attach context to system message
  // All textual data is stored in the metadata to avoid a roundtrip back to the API
  const retrievedContext = matches.matches
    .filter((match) => match.score > 0.7)
    .map((match) => {
      return `${match.metadata?.name}: ${match.metadata?.text}`;
    })
    .join("\n\n");

  console.log('retrievedContext:', retrievedContext, new Date());
  return retrievedContext;
}


// This endpoint is used to test the server
app.get('/', (ctx) => {
  return ctx.text('Hello Hono v2! in ' + ctx.env.ENVIRONMENT)
})

// This endpoint is used to ask questions to the AI with cloudflare models
app.post('/ai/chat', async (ctx) => {
  const payload = await ctx.req.json();
  const question = payload.user.message;
  console.log('question:', question, new Date());

  const results = await queryVector(ctx.env, question, 1);
  // const results = "";

  let docs: string[] = []
  console.log('Vector Results:', results, new Date());

  const contextMessage = docs.length
    ? `Context:\n${docs.map(doc => `- ${doc}`).join("\n")}`
    : ""
  const systemPrompt = `When answering the question or responding, use the context provided, if it is provided and relevant. Try to answer in 50 words and dont mention the context and give consize answer`

  const messages = [
    ...(docs.length ? [{ role: 'system', content: contextMessage }] : []),
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question }
  ]
  // const response = await ctx.env.AI.run(
  //   '@cf/meta/llama-3-8b-instruct',
  //   {
  //     messages,
  //     stream: true,
  //   }
  // );

  const groqClient = new Groq({
    apiKey: ctx.env.GROQ_API_KEY, // This is the default and can be omitted
  });

  const groqResponse = await groqClient.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt + (contextMessage.length ? 'Context: ' + contextMessage : '') },
      { role: 'user', content: 'Explain the importance of low latency LLMs' },
    ],
    model: LLM_MODEL,
    stream: true,
  });
  console.log(groqResponse);
  
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

// Add a new document/documents to the vector store
app.post("/ai/load", async (ctx) => {
  const embeddings = new CloudflareWorkersAIEmbeddings({
    binding: ctx.env.AI,
    model: EMBEDDING_MODEL,
  });

  const store = new CloudflareVectorizeStore(embeddings, {
    index: ctx.env.VECTORIZE,
  });

  const documents = [
    { pageContent: "hello", metadata: { text: "hello" } },
    { pageContent: "world", metadata: { text: "world" } },
    { pageContent: "hi", metadata: { text: "hi" } }
  ];

  await store.addDocuments(documents, {
    ids: ["id001", "id002", "id003"]
  });

  return ctx.json({ success: true });
});

// Delete documents from the vector store
app.delete("/ai/clear", async (ctx) => {
  const embeddings = new CloudflareWorkersAIEmbeddings({
    binding: ctx.env.AI,
    model: "@cf/baai/bge-base-en-v1.5",
  });

  const store = new CloudflareVectorizeStore(embeddings, {
    index: ctx.env.VECTORIZE,
  });
  await store.delete({ ids: ["id1", "id2", "id3"] });
  return Response.json({ success: true });
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