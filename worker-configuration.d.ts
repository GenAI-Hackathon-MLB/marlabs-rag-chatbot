import { Ai, VectorizeIndex } from '@cloudflare/workers-types';
interface Env {
  ENVIRONMENT: "dev" | "staging" | "production";
  EMBEDDING_MODEL: string;
  LLM_MODEL: string;
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
  JOBSUPDATER_WORKFLOW: Workflow;
  GROQ_API_KEY: string;
  OPENAI_API_KEY: string;
}


