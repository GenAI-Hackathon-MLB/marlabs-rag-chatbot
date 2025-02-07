
Clone this repo

##Install the dependencies
```
npm install
npm run dev
```

##Run locally for dev environment(in local mode)
```
npm run dev
```
which actually executes 
```
wrangler dev --experimental-vectorize-bind-to-prod --env dev
```

##create .dev.vars file and add
```
GROQ_API_KEY="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```


##D1 DB Migration from local to remote
All the D1 DB schema is store in ./schema/schema.sql file
```
npx wrangler d1 execute <DB NAME> --remote=true  --file=./schema/schema.sql
```