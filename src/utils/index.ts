import {
  CloudflareVectorizeStore,
  CloudflareWorkersAIEmbeddings
} from "@langchain/cloudflare";

import { Env } from "../../worker-configuration";

function getEmbeddings(env: Env) {
  const embeddings:CloudflareWorkersAIEmbeddings = new CloudflareWorkersAIEmbeddings({
    binding: env.AI,
    model: env.EMBEDDING_MODEL,
  });
  return embeddings;
}

function getVectorStore(env: Env) {
  const embeddings = getEmbeddings(env);
  const store:CloudflareVectorizeStore = new CloudflareVectorizeStore(embeddings, {
    index: env.VECTORIZE,
  });
  return store;
}

async function queryVectorDB(env:Env, query: string, topKwrgs: number = 3) {
  const store = getVectorStore(env);
  const results = await store.similaritySearchWithScore(query, topKwrgs);
  return results;
}

export { getEmbeddings, getVectorStore, queryVectorDB };