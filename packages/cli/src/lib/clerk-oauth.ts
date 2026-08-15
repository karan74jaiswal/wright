import crypto from "node:crypto";
import open from "open";
import { AuthManager } from "./auth";
import { getAuthHtml } from "./auth-html";
import { getInitialTheme } from "../providers/theme";

const getOAuthClientId = () => process.env.CLERK_OAUTH_CLIENT_ID || "yaDl7Aad1ghkRkZT";
const getFrontendApi = () => process.env.CLERK_FRONTEND_API || "https://magical-burro-2.clerk.accounts.dev";

function base64URLEncode(buffer: Buffer): string {
  return buffer.toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function generateCodeVerifier(): string {
  return base64URLEncode(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier: string): string {
  return base64URLEncode(crypto.createHash("sha256").update(verifier).digest());
}

export async function loginWithPKCE(signal?: AbortSignal): Promise<void> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  return new Promise((resolve, reject) => {
    const ports = [8989, 8990, 8991];
    let server: ReturnType<typeof Bun.serve> | null = null;
    let redirectUri = "";

    if (signal?.aborted) {
      return reject(new Error("Login was cancelled"));
    }

    const onAbort = () => {
      server?.stop(true);
      reject(new Error("Login was cancelled"));
    };
    signal?.addEventListener("abort", onAbort);

    async function handleCallback(req: Request): Promise<Response> {
      const url = new URL(req.url);
      if (url.pathname !== "/callback") {
        return new Response("Not Found", { status: 404 });
      }

      const code = url.searchParams.get("code");
      if (!code) {
        const errorMsg = url.searchParams.get("error_description") || url.searchParams.get("error") || "Authentication was aborted or failed.";
        setTimeout(() => server?.stop(true), 100);
        reject(new Error(`Authentication was aborted or failed: ${errorMsg}`));
        
        const theme = getInitialTheme();
        return new Response(getAuthHtml(false, errorMsg, theme.colors), {
          headers: { "Content-Type": "text/html" }
        });
      }

      try {
        // Exchange code for token
        const tokenRes = await fetch(`${getFrontendApi()}/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: getOAuthClientId(),
            code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
          }),
        });

        if (!tokenRes.ok) {
          throw new Error(`Failed to exchange token: ${await tokenRes.text()}`);
        }

        const data = await tokenRes.json() as any;
        
        await AuthManager.saveState({
          jwt: data.access_token,
          sessionId: data.refresh_token, // typically the refresh credential for PKCE
        });

        const theme = getInitialTheme();

        resolve();
        return new Response(getAuthHtml(true, undefined, theme.colors), {
          headers: { "Content-Type": "text/html" }
        });
      } catch (err: any) {
        const theme = getInitialTheme();
        reject(err);
        return new Response(getAuthHtml(false, err.message, theme.colors), {
          headers: { "Content-Type": "text/html" }
        });
      } finally {
        signal?.removeEventListener("abort", onAbort);
        setTimeout(() => server?.stop(true), 100);
      }
    }

    // Attempt to bind server now that handleCallback is defined
    let bound = false;
    for (const port of ports) {
      try {
        server = Bun.serve({
          port,
          fetch: handleCallback,
        });
        redirectUri = `http://localhost:${port}/callback`;
        bound = true;
        break;
      } catch (err) {
        // Port in use, try next
      }
    }

    if (!bound) {
      reject(new Error("Could not bind to any fallback port (8989, 8990, 8991). Please free one of these ports."));
      return;
    }

    const authorizeUrl = new URL(`${getFrontendApi()}/oauth/authorize`);
    authorizeUrl.searchParams.set("client_id", getOAuthClientId());
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");

    // Launch the browser automatically
    open(authorizeUrl.toString()).catch((err) => {
      server?.stop(true);
      reject(new Error(`Failed to open browser: ${err.message}`));
    });
  });
}

export async function refreshJWT(refreshToken: string): Promise<{ jwt: string, refreshToken: string }> {
  const tokenRes = await fetch(`${getFrontendApi()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: getOAuthClientId(),
      refresh_token: refreshToken,
    }),
  });

  if (!tokenRes.ok) {
    if (tokenRes.status === 401 || tokenRes.status === 404 || tokenRes.status === 400) {
      // Token is dead (user logged out, banned, etc)
      throw new Error("UNAUTHORIZED");
    }
    throw new Error(`Failed to refresh token: ${await tokenRes.text()}`);
  }

  const data = await tokenRes.json() as any;
  
  await AuthManager.saveState({
    jwt: data.access_token,
    sessionId: data.refresh_token, // Save the new refresh token if it rotated
  });

  return { jwt: data.access_token, refreshToken: data.refresh_token };
}

let activeRefreshPromise: Promise<{ jwt: string, refreshToken: string }> | null = null;

export function forceRefresh(): Promise<{ jwt: string, refreshToken: string }> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }
  
  // Assign synchronously before any await to prevent race conditions
  activeRefreshPromise = (async () => {
    try {
      const state = await AuthManager.getState();
      if (!state.sessionId) {
        throw new Error("UNAUTHORIZED"); // No session to refresh
      }
      return await refreshJWT(state.sessionId);
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}
