import http from "node:http";
import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import * as Sentry from "@sentry/bun";

import { appRouter } from "./index";

const app = express();
const port = 3001; // Session service runs strictly on 3001

app.use(cors());

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

app.get("/", (req, res) => {
  res.send("Session service is running");
});

// Sentry error handler should be after all controllers/middlewares
Sentry.setupExpressErrorHandler(app);

const server = http.createServer(app);

server.listen(port, () => {
  console.log(`Session service listening on port ${port}`);
});
