import {
  CloudflareVectorizeStore,
  CloudflareWorkersAIEmbeddings
} from "@langchain/cloudflare";

import { Env } from "../../worker-configuration";

async function getEmbeddings(env: Env) {
  const embeddings = new CloudflareWorkersAIEmbeddings({
    binding: env.AI,
    model: env.EMBEDDING_MODEL,
  });
  return embeddings;
}

async function getVectorStore(env: Env) {
  const embeddings = await getEmbeddings(env);
  const store = new CloudflareVectorizeStore(embeddings, {
    index: env.VECTORIZE,
  });
  return store;
}

async function queryVectorDB(env:Env, query: string, topKwrgs: number = 3) {
  const store = await getVectorStore(env);
  
  const results = await store.similaritySearchWithScore(query, topKwrgs);
  console.log("vector query: ", results);
  
  return results;
}

export { getEmbeddings, getVectorStore, queryVectorDB };