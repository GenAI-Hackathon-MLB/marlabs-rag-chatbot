
import { Hono } from 'hono'
import { Env } from "../../worker-configuration";

import {
  getVectorStore,
  getJobChunks,
  getAllJobLinks,
  getCleanJobList,
  getPageTextChunks,
  getChunksFromContent
} from '../utils';

// Hono c variables
type Variables = {
  userId: string;
};

const app = new Hono<{ Bindings: Env, Variables: Variables }>()

// update jobs in db and vector with latest scraped list
app.get('/updatejobs', async (ctx) => {

  const jobLinks = await getAllJobLinks();
  console.log('jobs:', jobLinks.length);

  const { entriesToAdd, entriesToDelete } = await getCleanJobList(jobLinks, ctx.env)

  // INIT VECTORIZE store
  const store = await getVectorStore(ctx.env);

  //DELETE
  for (const sqlid of entriesToDelete) {
    // DELETE from D1
    const delD1Result = await ctx.env.D1DB.prepare('DELETE FROM joblistings WHERE id=? RETURNING vids;').bind(sqlid).all();
    let delvids = String(delD1Result.results[0].vids)
    console.log("del sqlids:", sqlid);

    if (delvids) {
      const delvidsArr = delvids.split(',').map(uuid => uuid.trim());
      console.log("del vids:", delvidsArr);
      // DELETE from VECTORIZE
      await store.delete({ ids: delvidsArr });
    }
  }

  for (const { role, link } of entriesToAdd) {
    // chunks in Document[] form
    let chunks = await getJobChunks(link, ctx.env)

    // // Add more metadata/content to Vector chunks
    // chunks = chunks.map((chunk) => ({
    //   ...chunk,
    //   metadata: {
    //     ...chunk.metadata
    //   }
    // }))

    // ADD to VECTORIZE
    let vIds = await store.addDocuments(chunks)
    const vIdsStr = vIds.join(', ');
    // ADD to D1
    const d1Result = await ctx.env.D1DB.prepare('INSERT INTO joblistings (role, url, vids) VALUES (?1, ?2, ?3) RETURNING id;').bind(role, link, vIdsStr).all()
    const d1Id = String(d1Result.results[0].id) || ""

    console.log("added vids:", vIds);
    console.log("added sqlids:", d1Id);
  }

  return ctx.json({ success: true, added: entriesToAdd.length, deleted: entriesToDelete, totalScraped: jobLinks.length });
});

// input: url, title, content
// Add a new page document/documents to the vector store/d1 db knowledge base
app.post("/addwithcontent", async (ctx) => {
  const payload = await ctx.req.json();
  console.log('payload:', payload, new Date());

  const url = payload?.url;
  const title = payload?.title;
  const pageContent = payload?.content;
  if (!url || !title || !pageContent) {
    new Error("Expected parameters not provided: url, title, content")
  }

  const contentChunks = await getChunksFromContent(pageContent, url, title, ctx.env)
  // INIT VECTORIZE store
  const store = await getVectorStore(ctx.env);

  // ADD to VECTORIZE
  let vIds = await store.addDocuments(contentChunks)
  const vIdsStr = vIds.join(', ');

  // ADD to D1
  const d1Result = await ctx.env.D1DB.prepare('INSERT INTO knowledge_base (url, title, content, vids) VALUES (?1, ?2, ?3, ?4) RETURNING id;').bind(url, title, pageContent, vIdsStr).all();
  const d1Id = String(d1Result.results[0].id) || ""

  console.log("added vids:", vIds);
  console.log("added sqlids:", d1Id);

  return ctx.json({ success: true, url, title, vectorids: vIds, sqlid: d1Id });
});

// input: url
// Add a new page document/documents to the vector store/d1 db knowledge base
app.post("/addwithurl", async (ctx) => {
  const payload = await ctx.req.json();
  console.log('payload:', payload, new Date());
  
  const pageUrl = payload.url;

  // INIT VECTORIZE store
  const store = await getVectorStore(ctx.env);

  // Get page content, title, chunks
  const { pageChunks, pageContent, pageTitle } = await getPageTextChunks(pageUrl, ctx.env)

  // ADD to VECTORIZE
  let vIds = await store.addDocuments(pageChunks)
  const vIdsStr = vIds.join(', ');

  // ADD to D1
  const d1Result = await ctx.env.D1DB.prepare('INSERT INTO knowledge_base (url, title, content, vids) VALUES (?1, ?2, ?3, ?4) RETURNING id;').bind(pageUrl, pageTitle, pageContent, vIdsStr).all();
  const d1Id = String(d1Result.results[0].id) || ""

  console.log("added vids:", vIds);
  console.log("added sqlids:", d1Id);

  return ctx.json({ success: true, url: pageUrl, title: pageTitle, vectorids: vIds, sqlid: d1Id });
});


// Delete knowledge base document from the vector store/d1 db with d1 db id 
app.delete("/deletepage", async (ctx) => {
  const payload = await ctx.req.json();
  console.log('payload:', payload, new Date());

  const d1id = payload.d1id;

  // INIT VECTORIZE store
  const store = await getVectorStore(ctx.env);

  // DELETE from D1
  const delD1Result = await ctx.env.D1DB.prepare('DELETE FROM knowledge_base WHERE id=? RETURNING vids;').bind(d1id).all();
  let delvids = String(delD1Result.results[0].vids)
  console.log("del sqlid:", d1id);

  if (delvids) {
    const delvidsArr = delvids.split(',').map(uuid => uuid.trim());
    console.log("del vids:", delvidsArr);

    // DELETE from VECTORIZE
    await store.delete({ ids: delvidsArr });
  }

  return Response.json({ success: true, deletedvids: delvids, deletedd1id: d1id });
});

export default app;