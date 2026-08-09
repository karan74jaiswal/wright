import { Queue } from "bullmq";
import Redis from "ioredis";

const connection = new Redis("redis://localhost:6379", { maxRetriesPerRequest: null });
const chatQueue = new Queue("chat-jobs", { connection });

async function check() {
  const waiting = await chatQueue.getWaiting();
  const active = await chatQueue.getActive();
  const failed = await chatQueue.getFailed();
  console.log("Waiting:", waiting.length);
  console.log("Active:", active.length);
  console.log("Failed:", failed.length);
  
  if (failed.length > 0) {
      console.log("Failed job error:", failed[0].failedReason);
  }
  process.exit(0);
}
check();
