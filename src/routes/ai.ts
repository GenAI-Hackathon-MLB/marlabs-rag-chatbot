
import { Hono } from 'hono'
import { ChatGroq } from '@langchain/groq';
import { Env } from "../../worker-configuration";
import { streamText } from "hono/streaming";
import { queryVectorDB } from '../utils';
import Groq from 'groq-sdk';

import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { CloudflareD1MessageHistory } from "@langchain/cloudflare";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages"


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
    .join("\n\n") || "";

  return retrievedContext;
}

// This endpoint is used to ask querys to the AI with cloudflare models
app.post('/chat-stream', async (ctx) => {
  const payload = await ctx.req.json();
  console.log('payload:', payload, new Date());

  const query = payload.message;
  console.log('query:', query, new Date());

  const contextMessage = await queryVector(ctx.env, query, 3);
  // const results = "";
  console.log('retrievedContext:', contextMessage, new Date());

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

      // Each chunk contains a choices array where the delta (new text)
      // is in chunk.choices[0].delta.content. Write this chunk immediately.
      const id = chunk.id;
      const content = chunk.choices[0]?.delta.content || '';
      await stream.write(content);
    };
    // Close the stream when complete
    stream.close();
  })
})

// This endpoint is used to ask querys to the AI with cloudflare models
app.post('/chat', async (ctx) => {
  const payload = await ctx.req.json();
  console.log('payload:', payload, new Date());

  const query = payload.message;

  const memory = new BufferMemory({
    returnMessages: true,
    chatHistory: new CloudflareD1MessageHistory({
      tableName: "stored_message",
      sessionId: "example02",
      database: ctx.env.DB,
    }),
  });
  const messages = await memory.chatHistory.getMessages();
  console.log('memory:', messages, new Date());

  const contextMessage = await queryVector(ctx.env, query, 1);
  // const results = "";

  const systemPrompt = `
    You are helping a user with a query. When answering the query or responding, 
    use the context and chat history provided, if it is provided and relevant. 
    Try to answer in 50 words or less and dont mention the context and give concisee answer.
    Context:
    ${contextMessage}
  `;

  const groqClient = new ChatGroq({
    maxRetries: 3,
    apiKey: ctx.env.GROQ_API_KEY,
  });

  const chatPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      systemPrompt
    ],
    new MessagesPlaceholder("history"),
    ["human", "{input}"],
  ]);

  const chain = new ConversationChain({
    memory: memory,
    prompt: chatPrompt,
    llm: groqClient,
  });
  const chainResp = await chain.call({
    input: query,
  });

  console.log('chainResp:', chainResp, new Date());
  // const resp = await memory.chatHistory.addMessage(new HumanMessage(query));
  // console.log('MemoryResp:', resp, new Date());
  
  return ctx.text(chainResp.response);
})

export default app;