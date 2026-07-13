import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "pg";

let checkpointer: PostgresSaver | null = null;
let isSetup = false;

export function getCheckpointer() {
  if (!checkpointer) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
    checkpointer = new PostgresSaver(pool);
  }
  return checkpointer;
}

export async function setupCheckpointer() {
  if (!isSetup) {
    const cp = getCheckpointer();
    await cp.setup();
    isSetup = true;
  }
}
