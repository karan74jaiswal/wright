import "./env";
import { startWorker } from "./worker";

startWorker().catch(console.error);
