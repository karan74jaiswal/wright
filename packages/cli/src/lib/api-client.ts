import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@wright/api-gateway";

export const trpc = createTRPCReact<AppRouter>();
