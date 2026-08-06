import http from "node:http";
import express from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });

const app = express();
const port = Number(process.env.GATEWAY_PORT) || 3000;

const ALLOWED_ORIGINS = (
  process.env.CORS_ORIGINS || "http://localhost:3000"
).split(",");
app.use(cors({ origin: ALLOWED_ORIGINS }));

const SESSION_SERVICE_URL =
  process.env.SESSION_SERVICE_URL || "http://localhost:3001";
const CHAT_SERVICE_URL =
  process.env.CHAT_SERVICE_URL || "http://localhost:3002";

// Proxy /api/session.* to session-service
app.use(
  createProxyMiddleware({
    target: SESSION_SERVICE_URL,
    changeOrigin: true,
    pathFilter: (pathname) => /^\/api\/session(?:[./]|$)/.test(pathname),
    on: {
      error: (err, _req, res) => {
        console.error("Proxy error (session-service):", err.message);
        if (res && "writeHead" in res) {
          const serverRes = res as http.ServerResponse;
          if (!serverRes.headersSent) {
            serverRes.writeHead(502, {
              "Content-Type": "application/json",
            });
            serverRes.end(
              JSON.stringify({ error: "Session service unavailable" }),
            );
          } else {
            serverRes.end();
          }
        }
      },
    },
  }),
);

// Proxy /api/chat.* to chat-service
app.use(
  createProxyMiddleware({
    target: CHAT_SERVICE_URL,
    changeOrigin: true,
    pathFilter: (pathname) => /^\/api\/chat(?:[./]|$)/.test(pathname),
    on: {
      error: (err, _req, res) => {
        console.error("Proxy error (chat-service):", err.message);
        if (res && "writeHead" in res) {
          const serverRes = res as http.ServerResponse;
          if (!serverRes.headersSent) {
            serverRes.writeHead(502, {
              "Content-Type": "application/json",
            });
            serverRes.end(
              JSON.stringify({ error: "Chat service unavailable" }),
            );
          } else {
            serverRes.end();
          }
        }
      },
    },
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "api-gateway" });
});

app.get("/", (_req, res) => {
  res.send("API Gateway is running");
});

const server = http.createServer(app);
// Use elevated timeout for SSE streaming, but never disable completely
server.setTimeout(10 * 60 * 1000);

server.listen(port, () => {
  console.log(`API Gateway listening on port ${port}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log("API Gateway shutting down gracefully...");
  server.close(() => {
    console.log("API Gateway stopped.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
