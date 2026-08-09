import { z } from "zod";

export const McpServerConfigSchema = z.preprocess((val: any) => {
  if (typeof val === "object" && val !== null) {
    const config = { ...val };
    // Backward compatibility for legacy serverUrl
    if (config.serverUrl && !config.url) {
      config.url = config.serverUrl;
    }
    // Auto-infer type if missing
    if (!config.type) {
      if (config.url) config.type = "sse";
      else if (config.command) config.type = "stdio";
    }
    return config;
  }
  return val;
}, z.object({
  type: z.enum(["stdio", "http", "streamable-http", "sse", "ws"]),
  alwaysLoad: z.boolean().optional(),
  timeout: z.number().optional(),

  // stdio specific
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.any()).optional(),

  // http/sse/ws specific
  url: z.string().optional(),
  headers: z.record(z.string(), z.any()).optional(),
  headersHelper: z.string().optional(),

  // oauth
  oauth: z.object({
    clientId: z.string().optional(),
    callbackPort: z.number().optional(),
    scopes: z.string().optional(),
    authServerMetadataUrl: z.string().optional(),
  }).optional(),
}).passthrough());

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

export const McpFileSchema = z.object({
  mcpServers: z.record(z.string(), McpServerConfigSchema).optional(),
});
