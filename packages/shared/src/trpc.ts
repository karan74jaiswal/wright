import { initTRPC } from '@trpc/server';
import superjson from 'superjson';

export interface Context {
  // We can expand this with request context like user sessions later
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const mergeRouters = t.mergeRouters;
export const middleware = t.middleware;
