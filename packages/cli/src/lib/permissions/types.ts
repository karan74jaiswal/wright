export type PermissionScope = "session" | "system";

export interface PermissionRule {
  toolName: string;
  targetPattern: string; // The specific file, command, or wildcard
  scope: PermissionScope;
  grantedAt: number;
}

export interface PermissionCheckResult {
  allowed: boolean;
  rule?: PermissionRule;
}
