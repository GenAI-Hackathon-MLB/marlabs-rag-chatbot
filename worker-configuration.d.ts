import { Ai, VectorizeIndex } from '@cloudflare/workers-types';
interface Env {
  ENVIRONMENT: "dev" | "staging" | "production";
  CF_EMBEDDING_MODEL: string;
  GROQ_CHAT_MODEL: string;
  GROQ_SUMMARIZATION_MODEL: string;
  CF_AI: Ai;
  D1DB: D1Database;
  VECTORIZE: VectorizeIndex;
  JOBSUPDATER_WORKFLOW: Workflow;
  ADDVECTORS_WORKFLOW: Workflow;
  DELETEVECTORS_WORKFLOW: Workflow;
  GROQ_API_KEY: string;
}


