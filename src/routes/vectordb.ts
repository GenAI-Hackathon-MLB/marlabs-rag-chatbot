
import {
  CloudflareVectorizeStore,
  CloudflareWorkersAIEmbeddings
} from "@langchain/cloudflare";
import { Hono } from 'hono'
import { Env } from "../../worker-configuration";
import { queryVectorDB, getVectorStore } from '../utils';


const app = new Hono<{ Bindings: Env }>()


// Add a new document/documents to the vector store
app.post("/add", async (ctx) => {
  const store = await getVectorStore(ctx.env);

  const documents = [
    { pageContent: "hello", metadata: { text: "hello" } },
    { pageContent: "world", metadata: { text: "world" } },
    { pageContent: "hi", metadata: { text: "hi" } }
  ];

  await store.addDocuments(documents);

  return ctx.json({ success: true });
});

// Delete documents from the vector store
app.delete("/delete", async (ctx) => {
  const store = getVectorStore(ctx.env);

  await store.delete({ ids: ["id1", "id2", "id3"] });
  return Response.json({ success: true });
});

export default app;