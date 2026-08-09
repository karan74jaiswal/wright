import "./env";
import { startWorker } from "./worker";

startWorker().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
