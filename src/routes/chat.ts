
import { Hono } from 'hono'
import { ChatGroq } from '@langchain/groq';
import { Env } from "../../worker-configuration";
import { streamText } from "hono/streaming";

import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { CloudflareD1MessageHistory } from "@langchain/cloudflare";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { SystemMessage } from "@langchain/core/messages"
import { getCookie } from "hono/cookie";

import { queryVectorDB, getVectorStore, getVectorContext } from '../utils';

// Hono c variables
type Variables = {
  userId: string;
};

const app = new Hono<{ Bindings: Env, Variables: Variables }>()

// This endpoint is used to ask querys to the RAG AI models
app.post('/', async (ctx) => {

  let chainResp: any = ""
  try {
    // userId from cookie
    const userId = getCookie(ctx, 'userId') || ctx.get('userId');
    const payload = await ctx.req.json();
    console.log('user:', userId, 'payload:', payload, new Date());

    // get user message
    const query = payload.message;

    // Initialize LLM client with Groq
    const groqClient = new ChatGroq({
      maxRetries: 3,
      apiKey: ctx.env.GROQ_API_KEY,
      temperature: 0.2,
      maxTokens: 300,
      model: ctx.env.GROQ_CHAT_MODEL,
    });

    // chat history buffer memory in D1 DB
    const memory = new BufferMemory({
      returnMessages: true,
      memoryKey: 'chat-history',
      chatHistory: new CloudflareD1MessageHistory({
        tableName: "conversation_history",
        sessionId: userId,
        database: ctx.env.D1DB,
      }),
    });

    // // check chat history length
    // const messages = await memory.chatHistory.getMessages();
    // console.log('memoryLength:', messages.length, new Date());

    // get vector contents and metadata as string
    const contextMessage = await getVectorContext(ctx.env, query, 10);
    // console.log("context:", contextMessage);

    // Define system prompt
    const sysPrompt = `
      Context:
      ${contextMessage}

      Instructions:
      "YOUR NAME IS MARS-AI chatbot" and you are chatbot on Marlabs Pvt ltd company website.
      1. If the "Context" section is non-empty and clearly related to the "Question", answer using ONLY the information provided in "Context". Be concise and factual. Also give link inside "(" and ")" from metadata for each job posting if available. 
      2. If the "Context" section is empty or does not contain sufficient information to answer the question, answer using your general pre-trained knowledge.
      3. If both the provided context and your general knowledge seem relevant, combine them carefully—base your answer on the context and supplement with general knowledge where needed.
      4. If you are not confident that you have enough information to answer accurately, respond with:
      "I'm sorry, I don't have enough information to answer that question."
      For all response should be text and Make responses short if possible.
    `

    // form prompt template
    const chatPrompt = ChatPromptTemplate.fromMessages([
      ["system", sysPrompt],
      new MessagesPlaceholder("chat-history"),
      ["human", "{input}"],
    ]);
    // console.log(chatPrompt);

    // form chain
    const chain = new ConversationChain({
      memory: memory,
      prompt: chatPrompt,
      llm: groqClient,
    });

    // response from chain
    chainResp = await chain.call({
      input: query,
    });

    console.log('chainResp:', chainResp, new Date());

  } catch (error) {
    if (error instanceof Error) {
      console.error('Error Message:', error);
      return ctx.text('Unable to answer now, please try after some times.');
    } else {
      console.error('Error:', String(error));
      return ctx.text('Unable to answer now, please try after some times.');
    }
  }
  return ctx.text(chainResp.response);
})

// This endpoint is used to ask querys to the AI with cloudflare models
app.post('/stream-for-later', async (ctx) => {
  const payload = await ctx.req.json();
  console.log('payload:', payload, new Date());

  const query = payload.message;
  console.log('query:', query, new Date());

  const contextMessage = await getVectorContext(ctx.env, query, 5);
  // const results = "";
  // console.log('retrievedContext:', contextMessage, new Date());

  const groqClient = new ChatGroq({
    maxRetries: 3,
    apiKey: ctx.env.GROQ_API_KEY,
    temperature: 0.7,
    maxTokens: 1000,
    model: ctx.env.GROQ_CHAT_MODEL,
  });

  const memory = new BufferMemory({
    returnMessages: true,
    chatHistory: new CloudflareD1MessageHistory({
      tableName: "conversation_history",
      sessionId: "example05",
      database: ctx.env.D1DB,
    }),
  });


  const systemPrompt = `
    You are helping a user with a query. When answering the query or responding, 
    use the context and chat history provided, if it is provided and relevant. 
    Try to answer in 50 words or less and dont mention the context and give concisee answer.
    Context:
    ${contextMessage}
  `;
  console.log('SystemMessage:', SystemMessage, new Date());

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
    llm: groqClient
  });

  const chainResponse = await chain.stream({
    input: query,
  });

  console.log('response:', chainResponse.return, new Date());

  return streamText(ctx, async (stream) => {
    // const chunks = events(new Response(response as ReadableStream));
    for await (const chunk of chainResponse) {
      console.log('chunk:', chunk, new Date());

      await stream.write(JSON.stringify(chunk.response));
    };
    // Close the stream when complete
    stream.close();
  })
})

export default app;