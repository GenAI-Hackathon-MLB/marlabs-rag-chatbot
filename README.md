
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