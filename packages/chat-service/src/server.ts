import "./env";
import http from "node:http";
import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import * as Sentry from "@sentry/bun";
import { appRouter } from "./index";
import { abortAllStreams } from "./router";
import { prisma as db } from "@wright/database/client";
import { setupCheckpointer } from "@wright/agent";

const app = express();
const port = Number(process.env.CHAT_SERVICE_PORT) || 3002;

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:3000").split(",");
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: "1mb" }));

const createContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => {
  return { req, res };
};

app.use(
  "/api",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, path }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        Sentry.captureException(error, {
          tags: { path: `/api/${path}` },
        });
      }
    },
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "chat-service" });
});

app.get("/", (_req, res) => {
  res.send("Chat service is running");
});

const server = http.createServer(app);
// Use an elevated timeout for SSE streaming instead of disabling entirely.
// 10 minutes allows long AI responses without enabling Slowloris attacks.
server.setTimeout(10 * 60 * 1000);

// Initialize checkpointer tables once at boot, then start accepting connections
setupCheckpointer()
  .then(() => {
    server.listen(port, () => {
      console.log(`Chat service listening on port ${port}`);
    });
  })
  .catch((err: unknown) => {
    console.error("Failed to initialize checkpointer:", err);
    process.exit(1);
  });

// Graceful shutdown
const shutdown = async () => {
  console.log("Chat service shutting down gracefully...");
  abortAllStreams();
  server.close(() => {
    console.log("Chat service stopped.");
  });
  try {
    await db.$disconnect();
  } catch (e) {
    console.error("Failed to disconnect database:", e);
  }
  // Force exit after 10 seconds if connections don't drain
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
