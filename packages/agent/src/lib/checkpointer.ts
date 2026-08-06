import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "pg";

let pool: Pool | null = null;
let checkpointer: PostgresSaver | null = null;
let setupPromise: Promise<void> | null = null;

export function getCheckpointer() {
  if (!checkpointer) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
    checkpointer = new PostgresSaver(pool);
  }
  return checkpointer;
}

export function setupCheckpointer(): Promise<void> {
  if (!setupPromise) {
    const cp = getCheckpointer();
    setupPromise = cp.setup().catch((err) => {
      // Reset so the next call retries instead of permanently caching a rejected promise
      setupPromise = null;
      throw err;
    });
  }
  return setupPromise;
}

export async function shutdownCheckpointer(): Promise<void> {
  if (pool) {
    const p = pool;
    pool = null;
    checkpointer = null;
    setupPromise = null;
    
    try {
      await p.end();
    } catch (e) {
      console.error("Error during checkpointer shutdown:", e);
    }
  }
}
