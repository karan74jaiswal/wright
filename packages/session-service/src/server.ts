import http from "node:http";
import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import * as Sentry from "@sentry/bun";

import { appRouter } from "./index";

const app = express();
const port = Number(process.env.SESSION_SERVICE_PORT) || 3001;

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:3000").split(",");
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: "1mb" }));

// Context creation
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
  res.json({ status: "ok", service: "session-service" });
});

app.get("/", (_req, res) => {
  res.send("Session service is running");
});

// Sentry error handler should be after all controllers/middlewares
Sentry.setupExpressErrorHandler(app);

const server = http.createServer(app);

server.listen(port, () => {
  console.log(`Session service listening on port ${port}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log("Session service shutting down gracefully...");
  server.close(() => {
    console.log("Session service stopped.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
