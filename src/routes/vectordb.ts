
import { Hono } from 'hono'
import { Env } from "../../worker-configuration";
import { getEmbeddings, queryVectorDB, getVectorStore } from '../utils';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const app = new Hono<{ Bindings: Env }>()


// Add a new document/documents to the vector store
app.post("/add", async (ctx) => {
  const payload = await ctx.req.json();
  console.log('payload:', payload, new Date());

  const message = payload.message;

  const splitter = new RecursiveCharacterTextSplitter({
    // These can be customized to change the chunking size
    // chunkSize: 1000,
    // chunkOverlap: 200,
  });
  
  const output = await splitter.createDocuments([message]);

  const store = await getVectorStore(ctx.env);

  const documents = [
    { pageContent: "hello", metadata: { text: "hello" } },
    { pageContent: "world", metadata: { text: "world" } },
    { pageContent: "hi", metadata: { text: "hi" } }
  ];

  const embeddings = await getEmbeddings(ctx.env);
  const vectors = await embeddings.embedDocuments(documents.map((doc) => doc.pageContent));

  const ids = await store.addVectors(vectors, documents);

  return ctx.json({ success: true });
});

// Delete documents from the vector store
app.delete("/delete", async (ctx) => {
  const store = await getVectorStore(ctx.env);
  await store.delete({ ids: ["id1", "id2", "id3"] });
  return Response.json({ success: true });
});

export default app;