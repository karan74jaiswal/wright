import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';

export interface Context {
  userId?: string;
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" }); 
  }
  return next({
    ctx: {
      userId: ctx.userId,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);
export const mergeRouters = t.mergeRouters;
export const middleware = t.middleware;
