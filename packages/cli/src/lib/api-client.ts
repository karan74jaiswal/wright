import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@wright/api-gateway";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
