import { Queue } from "bullmq";
import { createRedisClient } from "@wright/redis";

const connection = createRedisClient();
export const chatQueue = new Queue("chat-jobs", { connection });
