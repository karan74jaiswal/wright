import http from "node:http";
import express from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });

const app = express();
const port = 3000;

app.use(cors());

// Proxy /api/session.* to session-service on port 3001
app.use(
  createProxyMiddleware({
    target: "http://localhost:3001",
    changeOrigin: true,
    pathFilter: (pathname, req) => pathname.startsWith("/api/session"),
  }),
);

// Proxy /api/chat.* to chat-service on port 3002
app.use(
  createProxyMiddleware({
    target: "http://localhost:3002",
    changeOrigin: true,
    pathFilter: (pathname, req) => pathname.startsWith("/api/chat"),
  }),
);

app.get("/", (req, res) => {
  res.send("API Gateway is running");
});

const server = http.createServer(app);
server.setTimeout(0);

server.listen(port, () => {
  console.log(`API Gateway listening on port ${port}`);
});
