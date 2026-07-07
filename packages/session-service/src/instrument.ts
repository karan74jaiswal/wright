import * as Sentry from "@sentry/bun";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });

Sentry.init({
  dsn: "https://e5386e2e338f556a12b37a2ed3f3738b@o4511687186710528.ingest.de.sentry.io/4511687204536400",
  tracesSampleRate: 1.0,
  enableLogs: true,
});
