import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export interface AuthState {
  sessionId?: string;
  jwt?: string;
  jwtExpiresAt?: number;
}

export class AuthManager {
  private static get configDir(): string {
    return path.join(os.homedir(), ".wright");
  }

  private static get authFile(): string {
    return path.join(this.configDir, "auth.json");
  }

  public static async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
    } catch (err) {
      // Ignore if directory already exists
    }
  }

  public static async getState(): Promise<AuthState> {
    try {
      const data = await fs.readFile(this.authFile, "utf-8");
      return JSON.parse(data) as AuthState;
    } catch (err) {
      return {};
    }
  }

  public static async saveState(state: AuthState): Promise<void> {
    await this.ensureDir();
    const currentState = await this.getState();
    const newState = { ...currentState, ...state };
    await fs.writeFile(this.authFile, JSON.stringify(newState, null, 2), {
      mode: 0o600,
    });
  }

  public static async clearState(): Promise<void> {
    try {
      await fs.unlink(this.authFile);
    } catch (err) {
      // Ignore if file doesn't exist
    }
  }
}
