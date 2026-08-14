import "./env";
import http from "node:http";
import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import * as Sentry from "@sentry/bun";
import { appRouter } from "./index";
import { prisma as db } from "@wright/database/client";
import { setupCheckpointer, shutdownCheckpointer } from "@wright/agent";
import { setupBullBoard } from "./dashboard";

const app = express();
const port = Number(process.env.CHAT_SERVICE_PORT) || 3002;

const ALLOWED_ORIGINS = (
  process.env.CORS_ORIGINS || "http://localhost:3000"
).split(",");
app.use(cors({ origin: ALLOWED_ORIGINS }));

const largePayloadParser = express.json({ limit: "50mb" });
const standardPayloadParser = express.json({ limit: "2mb" });

app.use((req, res, next) => {
  // Only allow large payloads for the EXACT tRPC submission route (including batched variants)
  if (/(?:\/|,)chat\.submitChatJob(?:,|$)/.test(req.path)) {
    return largePayloadParser(req, res, next);
  }
  return standardPayloadParser(req, res, next);
});

// Internal security middleware: prevent direct access bypassing the gateway
app.use("/api", (req, res, next) => {
  const internalSecret = req.headers["x-internal-secret"];
  const expectedSecret = process.env.JWT_SECRET || "jwt-secret";
  if (internalSecret !== expectedSecret) {
    res.status(403).json({ error: "Direct access to microservice forbidden. Please route through API Gateway." });
    return;
  }
  next();
});

const createContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => {
  const userId = req.headers["x-user-id"] as string | undefined;
  return { req, res, userId };
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

// Easily toggle this on/off when you want to monitor jobs!
const ENABLE_DASHBOARD = process.env.ENABLE_BULL_DASHBOARD === "true"; 
if (ENABLE_DASHBOARD) {
  app.use("/admin/queues", (req, res, next) => {
    const remoteIp = req.socket.remoteAddress;
    const isLocal = remoteIp === "127.0.0.1" || remoteIp === "::1" || remoteIp === "::ffff:127.0.0.1";
    if (!isLocal) {
      return res.status(403).send("Dashboard is restricted to local interface.");
    }
    const b64auth = (req.headers.authorization || "").split(" ")[1] || "";
    const [login, password] = Buffer.from(b64auth, "base64").toString().split(":");
    const expectedPassword = process.env.BULL_BOARD_PASSWORD;
    
    if (!expectedPassword || login !== "admin" || password !== expectedPassword) {
      res.set("WWW-Authenticate", 'Basic realm="Bull Board"');
      return res.status(401).send("Authentication required.");
    }
    next();
  });
  setupBullBoard(app);
}

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
  
  const closePromise = new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  try {
    await Promise.race([
      closePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000))
    ]);
  } catch (e) {
    console.log("Forcing close of lingering HTTP connections...");
    if (server.closeAllConnections) server.closeAllConnections();
  }
  
  console.log("Chat service stopped.");

  try {
    await shutdownCheckpointer();
  } catch (e) {
    console.error("Failed to shutdown checkpointer:", e);
  }
  try {
    await db.$disconnect();
  } catch (e) {
    console.error("Failed to disconnect database:", e);
  }
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
