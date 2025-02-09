
Clone this repo

## Install the dependencies
```
npm install
npm run dev
```

## Run locally for dev environment(in local mode)
```
npm run dev
```
which actually executes 
```
wrangler dev --experimental-vectorize-bind-to-prod --env dev
```
also add this command for running cron in local 
```
--test-scheduled
```

## create .dev.vars file and add
```
GROQ_API_KEY="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```


## Environment Variables:
```
ENVIRONMENT: "dev"
CF_EMBEDDING_MODEL: <embedding_model_name>
GROQ_CHAT_MODEL: <llm model for chat/text generation>
GROQ_SUMMARIZATION_MODEL: <llm model for text cleanup/summarization>
```

## ML MODEL USED
```
Cloudflare EMBEDDING_MODEL: "@cf/baai/bge-base-en-v1.5"
Groq for response/text generation: "llama-3.3-70b-versatile"
Groq model for text summary: "mixtral-8x7b-32768"
```

## LLM client
for LLM chat
```
import { ChatGroq } from '@langchain/groq';
```
for text summarization
```
import Groq from 'groq-sdk'
```

##  Chat history(Memory)

```
// Buffermemory from langchain 
import { BufferMemory } from "langchain/memory";

// To connect chat history with D1 DB
import { CloudflareD1MessageHistory } from "@langchain/cloudflare";

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
```

## RAG Chain
ConversationChain from langchain
Using this as it offers memory option for chat history
```
import { ConversationChain } from "langchain/chains";

// impelmentation
const chain = new ConversationChain({
      memory: memory,
      prompt: chatPrompt,
      llm: groqClient,
    });
```

## D1 DB Migration from local to remote
All the D1 DB schema is store in ./schema/schema.sql file
```
npx wrangler d1 execute <DB NAME> --remote=true  --file=./schema/schema.sql
```


## Chat UI
Dir==> /public/script.js
To embed chat ui to website add
```
<script src="http://<website url>/script.js" ></script>
<link rel="stylesheet" href="http://<website url>/style.css" />
```

## Packages/Libraries
"@langchain/cloudflare": "^0.1.0",
"@langchain/community": "^0.3.28",
"@langchain/core": "^0.3.37",
"@langchain/groq": "^0.1.3",
"@mozilla/readability": "^0.5.0",
"axios": "^1.7.9",
"cheerio": "^1.0.0",
"groq-sdk": "^0.13.0",
"hono": "^4.6.20",
"html-to-text": "^9.0.5"
