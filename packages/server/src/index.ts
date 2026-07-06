import dotenv from "dotenv";
import path from "node:path";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import sessions from "./routes/sessions";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });

const port = process.env.PORT || 3000;
const app = new Hono();
app.use(logger());

app.onError((err, c) => {
  if (err instanceof HTTPException)
    return c.json({ error: err.message || "Request failed" }, err.status);

  console.error(`unhandled server error ${err}`);
  return c.json({ error: "Internal Server Error" }, 500);
});

const routes = app.route("/sessions", sessions).get("/", (c) => {
  return c.text("server is running", 200);
});

export type AppType = typeof routes;

export default { port, fetch: app.fetch, idleTimeout: 255 };
