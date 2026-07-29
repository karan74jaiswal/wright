import "./env";
import http from "node:http";
import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./index";

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

server.listen(port, () => {
  console.log(`Chat service listening on port ${port}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log("Chat service shutting down gracefully...");
  server.close(() => {
    console.log("Chat service stopped.");
    process.exit(0);
  });
  // Force exit after 10 seconds if connections don't drain
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
