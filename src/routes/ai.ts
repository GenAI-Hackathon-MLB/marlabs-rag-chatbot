
import { Hono } from 'hono'
import { ChatGroq } from '@langchain/groq';
import { ChatOpenAI } from '@langchain/openai'
import { Env } from "../../worker-configuration";
import { streamText } from "hono/streaming";
import { queryVectorDB, getVectorStore } from '../utils';
import Groq from 'groq-sdk';

import { BufferMemory, BufferWindowMemory, ChatMessageHistory, ConversationSummaryMemory, ConversationTokenBufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { CloudflareD1MessageHistory } from "@langchain/cloudflare";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages"
import { createWorkersAI } from 'workers-ai-provider';
import { generateText } from 'ai';


const app = new Hono<{ Bindings: Env }>()

// This function is used to query the vector store with a query
async function queryVectorContext(env: Env, query: string, topKwrgs: number = 1) {
  // Get results from vector DB
  const results = await queryVectorDB(env, query, topKwrgs);

  // Attach context to system message
  const retrievedContext = results
    .filter(([document, score]) => score > 0.5)
    .map(([document, score]) => {
      const content = document.pageContent.replaceAll(/[{}]/g, '') || ""
      // Iterate over each key-value pair
      const metadata = document.metadata
      let metadataText = ""
      for (const key in metadata) {
        if (metadata.hasOwnProperty(key)) {
          metadataText += (`${key}: ${metadata[key]}` + " | ").replaceAll(/[{}]/g, '');
        }
      }
      return `Page Content: ${content} \nMetadata: ${metadataText}`;
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

  const contextMessage = await queryVectorContext(ctx.env, query, 5);
  // const results = "";
  // console.log('retrievedContext:', contextMessage, new Date());

  const groqClient = new ChatGroq({
    maxRetries: 3,
    apiKey: ctx.env.GROQ_API_KEY,
    temperature: 0.7,
    maxTokens: 1000,
    model: ctx.env.LLM_MODEL,
  });

  const memory = new BufferMemory({
    returnMessages: true,
    chatHistory: new CloudflareD1MessageHistory({
      tableName: "conversation_history",
      sessionId: "example05",
      database: ctx.env.DB,
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

// This endpoint is used to ask querys to the AI with cloudflare models
app.post('/chat', async (ctx) => {
  let chainResp: any = ""
  try {
    const payload = await ctx.req.json();
    console.log('payload:', payload, new Date());

    const query = payload.message;

    const groqClient = new ChatGroq({
      maxRetries: 3,
      apiKey: ctx.env.GROQ_API_KEY,
      temperature: 0.5,
      maxTokens: 300,
      model: ctx.env.LLM_MODEL,
    });

    const memory = new BufferMemory({
      returnMessages: true,
      memoryKey: 'chat-history',
      chatHistory: new CloudflareD1MessageHistory({
        tableName: "conversation_history",
        sessionId: "example06",
        database: ctx.env.DB,
      }),
    });
    const messages = await memory.chatHistory.getMessages();

    console.log('memoryLength:', messages.length, new Date());

    const contextMessage = await queryVectorContext(ctx.env, query, 5);

    const systemPrompt = `
    You are helping a user with a query on Marlabs website. Please be professional and helpful. When answering the query or responding, 
    use the context and chat history provided if it is relevant. Query related to this company if not found say you dont know.
    If asked about the job give job link also from context if thats available only. Do not respond any rich text/code and recepies.
    Try to answer in 50 words or less and dont mention the context and give concisee answer.
    Context:
    ${contextMessage}
  `;


    const chatPrompt = ChatPromptTemplate.fromMessages([
      [ "system", systemPrompt ],
      new MessagesPlaceholder("chat-history"),
      ["human", "{input}"],
    ]);
    console.log(chatPrompt);


    const chain = new ConversationChain({
      memory: memory,
      prompt: chatPrompt,
      llm: groqClient,
    });
    
    // const client = new Groq({
    //   apiKey: ctx.env.GROQ_API_KEY, // This is the default and can be omitted
    // });
    // const stream = await client.chat.completions.create({
    //   messages: ,
    //   stream: true,
    //   temperature: 0.7,
    // });

    chainResp = await chain.call({
      input: query,
    });

    console.log('chainResp:', chainResp, new Date());
    // const resp = await memory.chatHistory.addMessage(new HumanMessage(query));
    // console.log('MemoryResp:', resp, new Date());
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error fetching the URL:', error.message);
      return ctx.text(error.message);
    } else {
      console.error('Error fetching the URL:', String(error));
      return ctx.text(String(error));
    }
  }
  return ctx.text(chainResp.response);
})

export default app;