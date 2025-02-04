import { Ai, VectorizeIndex } from '@cloudflare/workers-types';
interface Env {
  ENVIRONMENT: "dev" | "staging" | "production";
  EMBEDDING_MODEL: string;
  LLM_MODEL: string;
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
  GROQ_API_KEY: string;
  HF_API_KEY: string;
}


