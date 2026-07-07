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

// Proxy /api to session-service on port 3001
app.use(
  "/api",
  createProxyMiddleware({
    target: "http://localhost:3001/api",
    changeOrigin: true,
  }),
);

app.get("/", (req, res) => {
  res.send("API Gateway is running");
});

const server = http.createServer(app);

server.listen(port, () => {
  console.log(`API Gateway listening on port ${port}`);
});
