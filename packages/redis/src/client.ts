import { Redis } from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export function createRedisClient() {
  return new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null
  });
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
