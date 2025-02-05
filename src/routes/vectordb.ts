
import { Hono } from 'hono'
import { Env } from "../../worker-configuration";
import { getEmbeddings, queryVectorDB, getVectorStore } from '../utils';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import { HTMLWebBaseLoader } from "@langchain/community/document_loaders/web/html";
import { MozillaReadabilityTransformer } from "@langchain/community/document_transformers/mozilla_readability";
import {CheerioWebBaseLoader} from "@langchain/community/document_loaders/web/cheerio";
import {HtmlToTextTransformer} from "@langchain/community/document_transformers/html_to_text";

import {getAllJobLinks, getJobChunks} from '../utils/career';
import { DocumentInterface } from '@langchain/core/documents';


const app = new Hono<{ Bindings: Env }>()

app.post('/jobsupdater', async (ctx) => {
  console.log(await ctx.env.JOBSUPDATER_WORKFLOW.create())
  return ctx.text("ok")
})

app.post('/updateJobs', async (ctx) => {

  const store = await getVectorStore(ctx.env);
  
  const jobLinks = await getAllJobLinks();
  // console.log('jobs:', jobs);
  let jobChunksList: DocumentInterface[] = []
  for (const {role, link} of jobLinks) {
    const chunks = await getJobChunks(link, ctx.env)
    console.log('jc l', chunks.length);
    
    jobChunksList = jobChunksList.concat(chunks)
    break
  }
  console.log("JC length",jobChunksList.length);
  

  // const ids = await store.addDocuments(jobChunksList);
  // console.log('ids', ids);
  

  
  return ctx.text('Job scrapping running now!')
});

// Add a new document/documents to the vector store
app.post("/add", async (ctx) => {
  const payload = await ctx.req.json();
  console.log('payload:', payload, new Date());

  const message = payload.message;
  

  return ctx.json({ success: true });
});

// Delete documents from the vector store
app.delete("/delete", async (ctx) => {
  const store = await getVectorStore(ctx.env);
  await store.delete({ ids: ["id1", "id2", "id3"] });
  return Response.json({ success: true });
});

export default app;