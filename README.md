
### Run locally for dev environment(in local mode)

```
wrangler dev --experimental-vectorize-bind-to-prod --env dev
```
also add this command for running cron in local 
```
--test-scheduled
```

### API Keys
Groq API key for llm
```
GROQ_API_KEY="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### D1 Database schema
Chat history
```
CREATE TABLE conversation_history (
  id TEXT PRIMARY KEY,
  session_id TEXT, 
  type TEXT, 
  content TEXT, 
  role TEXT, 
  name TEXT, 
  additional_kwargs TEXT
);
// Indexing based on id and session_id
CREATE INDEX id_index ON conversation_history (id);
CREATE INDEX session_id_index ON conversation_history (session_id);
```

Jobs listing records
```
CREATE TABLE joblistings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), 
  url TEXT NOT NULL UNIQUE, 
  role TEXT NOT NULL, 
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
  vids TEXT // storing vector db ids for related chunks
);
```

Other content as Knowledgebase
```
CREATE TABLE knowledge_base (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), 
  url TEXT NOT NULL UNIQUE, 
  title TEXT, 
  content TEXT, 
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
  vids TEXT  // Vector ids
);
```

## RAG

### Context Retriever
  #### Vector embedding
  ```
  import {CloudflareWorkersAIEmbeddings} from '@langchain/cloudflare';
  ...
  const embeddings = new CloudflareWorkersAIEmbeddings({
    binding: env.CF_AI,
    model: env.CF_EMBEDDING_MODEL,
  })
  ```
  #### Vector store
  ```
  import {CloudflareVectorizeStore} from '@langchain/cloudflare';
  ...
  const store = new CloudflareVectorizeStore(embeddings, {
    index: env.VECTORIZE,
  })
  ```
  #### Query vector db
  ```
  const queryContext = await store.similaritySearchWithScore(query, topKwrgs)
  ```
  #### Context filtering
  This respone will be passed to the RAG chain
  ```
  const contextMessage = queryContext.filter(([document, score]) => score > 0.7)
  ```

### ML MODEL USED
```
Cloudflare EMBEDDING_MODEL: "@cf/baai/bge-base-en-v1.5"
Groq for response/text generation: "llama-3.3-70b-versatile"
Groq model for text summary: "mixtral-8x7b-32768"
```

### RAG LLM client
for LLM chat
```
import { ChatGroq } from '@langchain/groq';
...
// Initialize LLM client with Groq
const groqClient = new ChatGroq({
  maxRetries: 3,
  apiKey: GROQ_API_KEY,
  temperature: 0.2,
  maxTokens: 300,
  model: GROQ_CHAT_MODEL,
});
```

###  Chat history(Memory)
Maintain persistant chat history
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
    database: D1DB,
  }),
});
```

### RAG Chain system prompt
```
Context:
${contextMessage}

Instructions:
"YOUR NAME IS MARS-AI chatbot" and you are chatbot on Marlabs Pvt ltd company website.
1. If the "Context" section is non-empty and clearly related to the "Question", answer using ONLY the information provided in "Context" and consider "Context.metadata.title" section also. Be concise and factual. Also give link inside "(" and ")" from metadata for each job posting if available. 
2. If the "Context" section is empty or does not contain sufficient information to answer the question, answer using your general pre-trained knowledge.
3. If both the provided context and your general knowledge seem relevant, combine them carefully—base your answer on the context and supplement with general knowledge where needed.
4. If you are not confident that you have enough information to answer accurately, respond with:
"I'm sorry, I don't have enough information to answer that question."
For all response should be text and Make responses short if possible.
```

### RAG Chain
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

### Document splitting
```
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
...

// split into chunks
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 100,
})
```

### Text summarization with AI

for text summarization
```
import Groq from 'groq-sdk'
...
const client = new Groq({
  apiKey: env.GROQ_API_KEY, // This is the default and can be omitted
})

// get summarized/cleaned text
const responseChat = await client.chat.completions.create({
  messages: [
    {
      role: 'system',
      content: `Clean following text in to text format, remove only new line character and tab caharacter. Input text string: ${pageContent}
      `
    },
  ],
  temperature: 0.2,
  model: env.GROQ_SUMMARIZATION_MODEL,
  max_tokens: 2000,
})
```

### Web scraping

```
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio'
import { HtmlToTextTransformer } from '@langchain/community/document_transformers/html_to_text'


const axios = require('axios') // To fetch HTML
const cheerio = require('cheerio') // For parsing HTML
```

### Packages/Libraries
  #### Server framework
  ```
  "hono": "^4.6.20"
  ```
  #### RAG CHain
  ```
  "@langchain/cloudflare": "^0.1.0", 
  "@langchain/community": "^0.3.28",
  "@langchain/core": "^0.3.37",
  ```
  #### LLM Client
  ```
  "@langchain/groq": "^0.1.3",
  "groq-sdk": "^0.13.0",
  ```
  #### Web scraping
  ```
  "@mozilla/readability": "^0.5.0",
  "axios": "^1.7.9", 
  "cheerio": "^1.0.0",
  "html-to-text": "^9.0.5"
  ```

### Chat UI
/public/script.js
/public/style.css
To embed chat ui to website add
```
<script src="http://<website url>/script.js" ></script>
<link rel="stylesheet" href="http://<website url>/style.css" />
```


## API Endpoints
### Chat
  - /chat
  - POST
  ```
  {
    "message": "5 jobs in marlabs?"
  }
  ```

### Knowledgebase
  #### Update Jobs
  - /knowledgebase/updatejobs
  - POST
  ```
  {}
  ```
  #### Add content with URL (Bot will scrape text from the given url)
  - /knowledgebase/addwithurl
  - POST
    ```
    {
      "url": "https://www.marlabs.com/insight/automation-boosts-profitability-by-90-for-brazilian-construction-giant/"
    }
    ```
  #### Add content with text content
  - /knowledgebase/addwithcontent
  - POST
    ```
    {
      "url": "https://www.marlabs.com/insight/automation-boosts-profitability-by-90-for-brazilian-construction-giant/",
      "title": "",
      "content": ""
    }
    ```
  ### Delete entry from knowledgebase
  - /knowledgebase/deleteitem
  - POST
    ```
    {
      "d1id": ""
    }
    ```
