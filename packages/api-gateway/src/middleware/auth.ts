import express from "express";
import { createClerkClient } from "@clerk/backend";

function decodeJwt(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

function decodeJwtExp(token: string): number | null {
  const payload = decodeJwt(token);
  if (payload && typeof payload.exp === "number") {
    return payload.exp * 1000;
  }
  return null;
}

export const tokenCache = new Map<
  string,
  { userId: string; expiresAt: number }
>();

// Run background garbage collection to prevent memory leaks from expired tokens
setInterval(() => {
  const now = Date.now();
  for (const [token, cached] of tokenCache.entries()) {
    if (now >= cached.expiresAt) {
      tokenCache.delete(token);
    }
  }
}, 60 * 1000).unref();

export const requireAuth: express.RequestHandler = async (req, res, next) => {
  let token = "";
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1] || "";
  }

  if (!token) {
    res.status(401).json({ error: "Missing or invalid Authorization token" });
    return;
  }

  // 1. Check cache first
  const cached = tokenCache.get(token);
  if (cached && Date.now() < cached.expiresAt) {
    req.headers["x-user-id"] = cached.userId;
    next();
    return;
  }

  try {
    let userId: string;
    const clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    });

    const authRequest = new Request("http://localhost", {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const expectedAudience = process.env.CLERK_OAUTH_AUDIENCE;

    const authState = await clerkClient.authenticateRequest(authRequest, {
      audience: expectedAudience,
      acceptsToken: ["session_token", "oauth_token"],
    });

    if (!authState.isAuthenticated) {
      throw new Error(`Token verification failed: ${authState.status}`);
    }

    userId = authState.toAuth().userId;

    // Validate required scopes if configured
    const requiredScopes = process.env.CLERK_OAUTH_SCOPES?.split(" ") || [];
    if (requiredScopes.length > 0) {
      const auth = authState.toAuth();
      const tokenScopes = (auth as any).scopes || [];
      for (const scope of requiredScopes) {
        if (!tokenScopes.includes(scope)) {
          throw new Error(`Missing required scope: ${scope}`);
        }
      }
    }

    // 4. Cache the successful resolution only if we have a known expiration
    const expiresAt = decodeJwtExp(token);
    if (expiresAt) {
      tokenCache.set(token, { userId, expiresAt });
    }

    // Inject trusted user ID for downstream microservices
    req.headers["x-user-id"] = userId;
    next();
  } catch (err: any) {
    console.error("Token verification failed:", err.message);
    res.status(401).json({ error: "Unauthorized" });
  }
};
