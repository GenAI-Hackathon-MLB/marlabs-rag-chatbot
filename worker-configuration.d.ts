import { Ai } from '@cloudflare/workers-types';
interface Env {
  ENVIRONMENT: "dev" | "staging" | "production";
  VECTORIZE: VectorizeIndex;
  AI: Ai;
  GROQ_API_KEY: string;
}
interface EmbeddingResponse {
  shape: number[];
  data: number[][];
}

