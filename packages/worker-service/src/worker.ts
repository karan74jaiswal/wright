import { Queue, Worker, Job } from "bullmq";
import { redis, createRedisClient } from "@wright/redis";
import { streamAgent, shutdownCheckpointer } from "@wright/agent";
import type { ChatRequest } from "@wright/shared";
import { EventEmitter } from "events";

const connection = createRedisClient();

// Global sub client for cancellations to avoid creating connections per job
const workerCancelEmitter = new EventEmitter();
workerCancelEmitter.setMaxListeners(1000);

const globalCancelSubClient = createRedisClient();
globalCancelSubClient.on("pmessage", (pattern, channel, message) => {
  workerCancelEmitter.emit(channel, message);
});

export async function startWorker() {
  await globalCancelSubClient.psubscribe("chat_cancel:*", "chat_ready_pubsub:*");
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

      const channel = `chat_stream:${sessionId}:${input.jobId}`;
      const cancelChannel = `chat_cancel:${sessionId}:${input.jobId}`;
      const ac = new AbortController();

      // Subscribe to cancellation events using the global emitter BEFORE waiting
      const onCancel = () => {
        ac.abort();
      };
      workerCancelEmitter.on(cancelChannel, onCancel);

      try {
        let cancelState = await redis.get(`chat_cancel_state:${sessionId}:${input.jobId}`);
        if (cancelState === "CANCEL") {
          console.log(`Job ${job.id} was cancelled before execution started.`);
          return;
        }

        // Explicit handshake: Wait up to 5 seconds for the SSE to connect
        const isReady = await redis.get(`chat_ready:${sessionId}:${input.jobId}`);
        if (!isReady) {
          console.log(`Waiting for SSE to connect for session ${sessionId}...`);
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              workerCancelEmitter.off(`chat_ready_pubsub:${sessionId}:${input.jobId}`, onReady);
              resolve();
            }, 5000);
            
            const onReady = () => {
              clearTimeout(timeout);
              resolve();
            };
            workerCancelEmitter.once(`chat_ready_pubsub:${sessionId}:${input.jobId}`, onReady);
          });
        }

        // Re-read chat_cancel_state after listener is active and wait is complete
        cancelState = await redis.get(`chat_cancel_state:${sessionId}:${input.jobId}`);
        if (cancelState === "CANCEL" || ac.signal.aborted) {
          console.log(`Job ${job.id} was cancelled during readiness wait.`);
          return;
        }

        const stream = streamAgent(input, ac.signal);
        let wasInterrupted = false;
        let hasEmittedTerminal = false;
        for await (const event of stream) {
          if (ac.signal.aborted) break;
          if ((event as any).type === "interrupt") {
            wasInterrupted = true;
          }
          if ((event as any).type === "done" || (event as any).type === "error") {
            hasEmittedTerminal = true;
          }
          // Publish the event to Pub/Sub using the global redis cache connection
          await redis.publish(channel, JSON.stringify({ ...event, jobId: input.jobId }));
        }
        
        if (!hasEmittedTerminal) {
          if (ac.signal.aborted) {
             await redis.publish(channel, JSON.stringify({ type: "error", message: "ABORTED", jobId: input.jobId }));
          } else if (!wasInterrupted) {
             await redis.publish(channel, JSON.stringify({ type: "done", jobId: input.jobId }));
          }
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
    try {
      await shutdownCheckpointer();
    } catch (e) {
      console.error("Failed to shutdown checkpointer:", e);
    }
    console.log("Worker stopped.");
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return worker;
}
