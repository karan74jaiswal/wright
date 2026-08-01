import { loadEnv } from "@wright/shared";
import * as Sentry from "@sentry/bun";

loadEnv(import.meta.dirname);

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  enableLogs: true,
});
