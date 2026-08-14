import fs from "node:fs";
import { loadEnv } from "@wright/shared";

loadEnv(fs.realpathSync(import.meta.dirname));
