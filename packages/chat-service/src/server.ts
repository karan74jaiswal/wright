import http from "node:http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./index";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

const app = express();
const port = 3002;

app.use(cors());

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

app.get("/", (req, res) => {
  res.send("Chat service is running");
});

const server = http.createServer(app);
server.setTimeout(0);

server.listen(port, () => {
  console.log(`Chat service listening on port ${port}`);
});
