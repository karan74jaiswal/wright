import express from "express";
import { verifyToken } from "@clerk/backend";
import { z } from "zod";

const userInfoSchema = z.object({
  user_id: z.string().optional(),
  sub: z.string().optional(),
}).transform((data) => {
  const id = data.user_id || data.sub;
  if (!id) {
    throw new Error("No user ID found in userinfo response");
  }
  return id;
});

function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8"));
    if (payload && typeof payload.exp === "number") {
      return payload.exp * 1000;
    }
  } catch {
    return null;
  }
  return null;
}

export const tokenCache = new Map<string, { userId: string; expiresAt: number }>();

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
    try {
      // 2. Try standard Session JWT verification first
      const verified = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      userId = verified.sub;
    } catch (err: any) {
      // 3. Fallback: If it's an OAuth token (at+jwt), verify via the userinfo endpoint
      if (err.message && err.message.includes("at+jwt")) {
        const frontendApi =
          process.env.CLERK_FRONTEND_API ||
          "https://magical-burro-2.clerk.accounts.dev";
        const userInfoRes = await fetch(`${frontendApi}/oauth/userinfo`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!userInfoRes.ok) {
          const text = await userInfoRes.text().catch(() => "");
          console.error(
            `OAuth userinfo failed: ${userInfoRes.status} ${userInfoRes.statusText}`,
            text,
          );
          throw new Error(`OAuth userinfo failed: ${userInfoRes.statusText}`, {
            cause: err,
          });
        }

        let userInfoJson: unknown;
        try {
          userInfoJson = await userInfoRes.json();
        } catch (parseErr) {
          throw new Error("Invalid JSON from userinfo response", {
            cause: parseErr,
          });
        }

        try {
          userId = userInfoSchema.parse(userInfoJson);
        } catch (zodErr) {
          console.error("Zod validation failed on userinfo response:", userInfoJson);
          throw new Error("No user ID found in userinfo response", {
            cause: zodErr,
          });
        }
      } else {
        throw err; // Not an at+jwt error, rethrow
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
