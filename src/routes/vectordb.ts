
import { Hono } from 'hono'
import { Env } from "../../worker-configuration";

import { getEmbeddings, queryVectorDB, getVectorStore, getJobChunks,getAllJobLinks, getCleanJobList } from '../utils';

// Hono c variables
type Variables = {
  userId: string;
};

const app = new Hono<{ Bindings: Env, Variables: Variables }>()

app.post('/jobsupdater', async (ctx) => {
  const wid = (await ctx.env.JOBSUPDATER_WORKFLOW.create()).id
  return ctx.text(wid)
})

app.post('/updateJobs', async (ctx) => {

  const jobLinks = await getAllJobLinks();
  console.log('jobs:', jobLinks.length);

  const { entriesToAdd, entriesToDelete } = await getCleanJobList(jobLinks, ctx.env)
  console.log("jobs:", entriesToAdd.length)

  const store = await getVectorStore(ctx.env);
  await store.delete({ ids: entriesToDelete });


  for (const { role, link } of entriesToAdd) {
    const chunks = await getJobChunks(link, ctx.env)

    const d1Result = await ctx.env.DB.prepare(`INSERT INTO joblistings (role, link) VALUES (?1, ?2) RETURNING id`).bind(role, link).all()
    const d1Id = String(d1Result.results[0].id) || ""

    const vIds = await store.addDocuments(chunks, { ids: [d1Id] })
  }

  return ctx.text('Job scrapping running now!')
});

// Add a new document/documents to the vector store
app.post("/addWithUrl", async (ctx) => {
  const payload = await ctx.req.json();
  console.log('payload:', payload, new Date());

  const url = payload.url;

  

  return ctx.json({ success: true });
});

// Delete documents from the vector store
app.delete("/delete", async (ctx) => {
  const store = await getVectorStore(ctx.env);
  await store.delete({ ids: ["id1", "id2", "id3"] });
  return Response.json({ success: true });
});

export default app;