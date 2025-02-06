
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
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages"


import { queryVectorDB, getVectorStore, getVectorContext } from '../utils';

const app = new Hono<{ Bindings: Env }>()


// This endpoint is used to ask querys to the AI with cloudflare models
app.post('/:sessionID', async (ctx) => {
  let chainResp: any = ""
  try {
    const payload = await ctx.req.json();
    const sessionId = ctx.req.param('sessionID')
    if(!sessionId){
      throw new Error("SessionID not available")
    }
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
        sessionId: "example08",
        database: ctx.env.DB,
      }),
    });
    const messages = await memory.chatHistory.getMessages();

    console.log('memoryLength:', messages.length, new Date());

    const contextMessage = await getVectorContext(ctx.env, query, 5);

    const systemPrompt = `
    You are helping a user with a query on Marlabs website and other general questions. Please be professional and helpful.
    When answering the query or responding, 
    use the context and chat history provided if it is relevant only.
    If asked about the job give job link also from context if thats available only.
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

// This endpoint is used to ask querys to the AI with cloudflare models
app.post('/stream', async (ctx) => {
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

export default app;