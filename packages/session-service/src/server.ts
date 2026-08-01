import http from "node:http";
import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import * as Sentry from "@sentry/bun";
import { prisma as db } from "@wright/database/client";

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
  res.json({ status: "ok", service: "session-service" });
});

app.get("/", (_req, res) => {
  res.send("Session service is running");
});


const server = http.createServer(app);

server.listen(port, () => {
  console.log(`Session service listening on port ${port}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log("Session service shutting down gracefully...");
  server.close(() => {
    console.log("Session service stopped.");
  });
  try {
    await db.$disconnect();
  } catch (e) {
    console.error("Failed to disconnect database:", e);
  }
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
