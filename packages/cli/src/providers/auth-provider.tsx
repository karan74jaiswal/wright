import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import type { AuthState } from "../lib/auth";
import { AuthManager } from "../lib/auth";
import { loginWithPKCE, forceRefresh } from "../lib/clerk-oauth";
import Spinner from "../components/spinner";
import Header from "../components/header";
import { useTheme } from "./theme";
import { useKeyboard } from "@opentui/react";

interface AuthContextType {
  jwt: string | null;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  isLoggingIn: boolean; // True when browser is open
  remoteLogout: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  acknowledgeRemoteLogout: () => void;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [jwt, setJwt] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true); // Cold start check
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [remoteLogout, setRemoteLogout] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshIntervalRef = useRef<Timer | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useKeyboard((key) => {
    if (isLoggingIn && key.name === "escape") {
      abortControllerRef.current?.abort();
    }
  });

  // Stop polling
  const stopPolling = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  };

  const startPolling = (refreshToken: string) => {
    stopPolling(); // ensure no duplicates

    // Poll every 45 seconds (Clerk JWT is 60s)
    refreshIntervalRef.current = setInterval(async () => {
      try {
        const { jwt: newJwt, refreshToken: newRefresh } =
          await forceRefresh();
        setJwt(newJwt);
        // If it rotated, we need to update the interval closure, but since we rely on the DB/AuthManager it's fine.
        // Actually it's better to recursively call startPolling if it rotates, but let's just clear and restart if needed.
        if (newRefresh !== refreshToken) {
          startPolling(newRefresh);
        }
      } catch (err: any) {
        if (err.message === "UNAUTHORIZED") {
          // User was banned or logged out remotely
          await handleLogout(true);
        }
      }
    }, 45_000);
  };

  const handleLogout = async (isRemote = false) => {
    stopPolling();
    await AuthManager.clearState();
    setJwt(null);
    if (isRemote) {
      setRemoteLogout(true);
    }
  };

  const acknowledgeRemoteLogout = () => {
    setRemoteLogout(false);
  };

  const login = async () => {
    setIsLoggingIn(true);
    abortControllerRef.current = new AbortController();

    const timeoutId = setTimeout(() => {
      setAuthError("Login timed out after 2 minutes. Please try again.");
      abortControllerRef.current?.abort();
    }, 120_000);

    try {
      await loginWithPKCE(abortControllerRef.current.signal);
      const state = await AuthManager.getState();
      if (state.jwt && state.sessionId) {
        setJwt(state.jwt);
        startPolling(state.sessionId);
      }
    } catch (err: any) {
      if (err.message !== "Login was cancelled") {
        setAuthError(`Login failed: ${err.message}`);
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoggingIn(false);
      abortControllerRef.current = null;
    }
  };

  // Initial boot check
  useEffect(() => {
    const bootCheck = async () => {
      const minDelay = new Promise((resolve) => setTimeout(resolve, 5000));

      const authTask = async () => {
        const state = await AuthManager.getState();
        if (state.sessionId) {
          try {
            const { jwt: newJwt, refreshToken } = await forceRefresh();
            setJwt(newJwt);
            startPolling(refreshToken);
          } catch (err: any) {
            if (err.message === "UNAUTHORIZED") {
              await handleLogout(false); // Silent on boot
            }
          }
        }
      };

      await Promise.all([authTask(), minDelay]);
      setIsAuthenticating(false);
    };

    bootCheck();

    return () => stopPolling();
  }, []);

  const contextValue = {
    jwt,
    isAuthenticated: !!jwt,
    isAuthenticating,
    isLoggingIn,
    remoteLogout,
    login,
    logout: () => handleLogout(false),
    acknowledgeRemoteLogout,
    authError,
    clearAuthError: () => setAuthError(null),
  };

  if (isAuthenticating || isLoggingIn) {
    return (
      <AuthContext.Provider value={contextValue}>
        <box
          flexDirection="column"
          width="100%"
          height="100%"
          justifyContent="center"
          alignItems="center"
          backgroundColor={colors.background}
          gap={1}
        >
          <Header />
          <box flexDirection="column" alignItems="center">
            <text fg={colors.dimSeparator}>
              {isAuthenticating
                ? "Signing in..."
                : "Opening browser... Waiting for authentication callback..."}
            </text>
            {isLoggingIn && (
              <text fg={colors.dimSeparator}>(Press ESC to cancel)</text>
            )}
            <Spinner />
          </box>
        </box>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
