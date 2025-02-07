
import { Hono } from 'hono'
import { Env } from "../../worker-configuration";

import {
  getVectorStore,
  getJobChunks,
  getAllJobLinks,
  getCleanJobList,
  getPageTextChunks
} from '../utils';

// Hono c variables
type Variables = {
  userId: string;
};

interface JobDbEntry {
  id: string;
  role: string;
  url: string;
  created_at: number;
}

const app = new Hono<{ Bindings: Env, Variables: Variables }>()

app.post('/updatejobs', async (ctx) => {

  const jobLinks = await getAllJobLinks();
  console.log('jobs:', jobLinks.length);

  const { entriesToAdd, entriesToDelete } = await getCleanJobList(jobLinks, ctx.env)
  
  const store = await getVectorStore(ctx.env);

  //DELETE
  for (const sqlid of entriesToDelete) {
    const delD1Result = await ctx.env.D1DB.prepare('DELETE FROM joblistings WHERE id=? RETURNING vids;').bind(sqlid).all();
    let delvids = String(delD1Result.results[0].vids)
    console.log("del sqlids:",sqlid);

    if (delvids) {
      const delvidsArr = delvids.split(',').map(uuid => uuid.trim());
      console.log("del vids:",delvidsArr);

      await store.delete({ ids: delvidsArr });
    }
    
  }


  for (const { role, link } of entriesToAdd) {
    let chunks = await getJobChunks(link, ctx.env)

    chunks = chunks.map((chunk) => ({
      ...chunk,
      metadata: {
        ...chunk.metadata
      }
    }))

    let vIds = await store.addDocuments(chunks)
    const vIdsStr = vIds.join(', ');
    const d1Result = await ctx.env.D1DB.prepare('INSERT INTO joblistings (role, url, vids) VALUES (?1, ?2, ?3) RETURNING id').bind(role, link, vIdsStr).all<JobDbEntry>()
    const d1Id = String(d1Result.results[0].id) || ""

    console.log("added vids:", vIds);
    console.log("added sqlids:", d1Id);
  }

  return ctx.text(`Job updating done!, all jobs: ${jobLinks.length}, deleted: ${entriesToDelete.length}, added: ${entriesToAdd.length}.`)
});

// Add a new document/documents to the vector store
app.post("/addwithurl", async (ctx) => {
  const payload = await ctx.req.json();
  console.log('payload:', payload, new Date());

  const pageUrl = payload.url;
  await getPageTextChunks(pageUrl, ctx.env)

  return ctx.json({ success: true });
});

// Delete documents from the vector store
app.delete("/delete", async (ctx) => {
  const store = await getVectorStore(ctx.env);
  await store.delete({ ids: ["id1", "id2", "id3"] });
  return Response.json({ success: true });
});

export default app;