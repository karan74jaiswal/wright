import { Queue, Worker, Job } from "bullmq";
import { redis, createRedisClient } from "@wright/redis";
import { streamAgent } from "@wright/agent";
import type { ChatRequest } from "@wright/shared";
import { EventEmitter } from "events";

const connection = createRedisClient();

// Global sub client for cancellations to avoid creating connections per job
const workerCancelEmitter = new EventEmitter();
workerCancelEmitter.setMaxListeners(1000);

const globalCancelSubClient = createRedisClient();
globalCancelSubClient.psubscribe("chat_cancel:*").catch(console.error);
globalCancelSubClient.on("pmessage", (pattern, channel, message) => {
  workerCancelEmitter.emit(channel, message);
});

export function startWorker() {
  console.log("Starting chat worker...");

  const worker = new Worker(
    "chat-jobs",
    async (job: Job) => {
      const input = job.data as ChatRequest & {
        skills?: Record<string, any>;
        mcpServers?: Record<string, any>;
      };
      const { sessionId } = input;
      console.log(`Processing job ${job.id} for session ${sessionId}...`);

      const channel = `chat_stream:${sessionId}`;
      const cancelChannel = `chat_cancel:${sessionId}`;
      const ac = new AbortController();

      // Subscribe to cancellation events using the global emitter
      const onCancel = () => {
        ac.abort();
      };
      workerCancelEmitter.on(cancelChannel, onCancel);

      try {
        const stream = streamAgent(input, ac.signal);
        let wasInterrupted = false;
        for await (const event of stream) {
          if (ac.signal.aborted) break;
          if ((event as any).type === "interrupt") {
            wasInterrupted = true;
          }
          // Publish the event to Pub/Sub using the global redis cache connection
          await redis.publish(channel, JSON.stringify({ ...event, jobId: input.jobId }));
        }
        
        if (ac.signal.aborted) {
           await redis.publish(channel, JSON.stringify({ type: "error", message: "ABORTED", jobId: input.jobId }));
        } else if (!wasInterrupted) {
           await redis.publish(channel, JSON.stringify({ type: "done", jobId: input.jobId }));
        }

      } catch (err: any) {
        console.error("Worker error executing streamAgent:", err);
        await redis.publish(channel, JSON.stringify({ type: "error", message: err.message || "Unknown error", jobId: input.jobId }));
      } finally {
        workerCancelEmitter.off(cancelChannel, onCancel);
      }
    },
    { connection: connection as any, concurrency: 10 }
  );

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed with ${err.message}`);
  });

  const shutdown = async () => {
    console.log("Worker shutting down gracefully...");
    await worker.close();
    console.log("Worker stopped.");
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return worker;
}
