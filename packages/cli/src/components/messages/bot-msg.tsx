import { TextAttributes } from "@opentui/core";
import { useTheme } from "../../providers/theme";
import { MarkdownViewer } from "../markdown-viewer";
import { Mode } from "@wright/database/enums";
import prettyMilliseconds from "pretty-ms";
import ThinkingSpinner from "../thinking-spinner";
import { usePromptConfig } from "../../providers/prompt-config";
import { EmptyBorder } from "../border";

export interface BotMsgProps {
  content: string;
  model: string;
  reasoning?: string;
  toolCalls?: Record<string, { name: string; args: string; result?: any }>;
  streaming?: boolean;
  mode?: Mode;
  status?: string;
  duration?: number | null;
  reasoningDuration?: number | null;
  showReasoning?: boolean;
  reasoningEffort?: string | null;
  hideFooter?: boolean;
  hideHeader?: boolean;
}

function getToolResultStatus(result: any): { label: string; color: string; errorMsg?: string } {
  if (typeof result !== "string") return { label: "(Success)", color: "success" };
  
  const lower = result.toLowerCase().trim();
  
  // If a tool explicitly throws an error or fails, LangGraph prefixes with Error: or similar
  if (lower.startsWith("error:") || lower.startsWith("error ") || lower.includes("user denied permission")) {
    // Check if it's a denial
    if (lower.includes("denied permission") || lower.includes("declined")) {
      return { label: "(Failed)", color: "error", errorMsg: "User declined the tool call" };
    }
    return { label: "(Failed)", color: "error", errorMsg: result };
  }
  
  return { label: "(Success)", color: "success" };
}

export function formatToolName(name: any): string {
  if (!name) return "";
  if (typeof name !== "string") return String(name);
  // Split on underscores, hyphens, or colons
  return name
    .split(/[_:-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export const BotMsg = ({
  content,
  model,
  mode,
  status,
  reasoning,
  toolCalls,
  duration,
  streaming = false,
  reasoningDuration,
  showReasoning = false,
  reasoningEffort,
  hideFooter = false,
  hideHeader = false,
}: BotMsgProps) => {
  const { colors } = useTheme();
  const { currentModel, reasoningEffort: globalEffort } = usePromptConfig();

  const isReasoningModel =
    model.startsWith("o1") ||
    model.startsWith("o3") ||
    model.startsWith("o4") ||
    model.startsWith("gpt-5") ||
    model.startsWith("gemini-3") ||
    model.startsWith("gemini-2.5") ||
    model.startsWith("gemini-2.0-flash-thinking");

  // Determine what effort string to display (persisted message effort > global current effort > nothing)
  const displayEffort = reasoningEffort || (streaming ? globalEffort : null);
  const formattedEffort = displayEffort
    ? displayEffort.charAt(0).toUpperCase() + displayEffort.slice(1)
    : "";

  return (
    <box width="100%" alignItems="flex-start" flexDirection="column">
      <box
        paddingTop={hideHeader ? 0 : 1}
        paddingBottom={hideFooter ? 0 : 1}
        width="100%"
        flexDirection="column"
      >
        {reasoning ? (
          <box
            paddingX={2}
            width="100%"
            border={["left"]}
            borderColor={colors.thinkingBorder}
            paddingY={1}
            customBorderChars={{
              ...EmptyBorder,
              vertical: "│",
            }}
            flexDirection="column"
            gap={showReasoning ? 1 : 0}
          >
            <box flexDirection="row" gap={1}>
              <text attributes={TextAttributes.DIM}>
                <em fg={colors.thinking}>
                  {showReasoning ? "▼" : "▶"}{" "}
                  {streaming
                    ? "Thinking..."
                    : `Thought${reasoningDuration ? ` for ${prettyMilliseconds(reasoningDuration)}` : ""}`}
                </em>
              </text>

              {streaming ? <ThinkingSpinner /> : null}
              <text attributes={TextAttributes.DIM}>
                <em fg={colors.thinking}>
                  {showReasoning
                    ? "(ctrl + o to collapse)"
                    : "(ctrl + o to expand)"}
                </em>
              </text>
            </box>
            {showReasoning && (
              <text attributes={TextAttributes.DIM}>{reasoning}</text>
            )}
          </box>
        ) : null}

        {content ? (
          <box paddingX={3} width="100%">
            <MarkdownViewer content={content} streaming={streaming} />
          </box>
        ) : null}

        {(() => {
          const validToolCalls = toolCalls
            ? Object.values(toolCalls).filter((tc) => tc.name && tc.name.toLowerCase() !== "unknown")
            : [];
          if (validToolCalls.length === 0) return null;

          return (
            <box
              border={["left"]}
              borderColor={colors.thinkingBorder}
              customBorderChars={{
                ...EmptyBorder,
                vertical: "│",
              }}
              paddingX={2}
              width="100%"
              paddingTop={content ? 1 : 0}
              flexDirection="column"
            >
              {validToolCalls.map((tc, idx) => {

              let parsedArgsObj: Record<string, any> | null = null;
              let rawArgs = tc.args;
              try {
                parsedArgsObj =
                  typeof tc.args === "string" ? JSON.parse(tc.args) : tc.args;
              } catch (e) {
                // Keep raw string if JSON parsing fails
              }

              // Hide options for completed ask_question to keep history clean
              if (parsedArgsObj && typeof parsedArgsObj === "object" && tc.name === "ask_question" && tc.result) {
                parsedArgsObj = { ...parsedArgsObj };
                delete parsedArgsObj.options;
                delete parsedArgsObj.isMultiSelect;
              }

              const statusInfo = tc.result
                ? getToolResultStatus(tc.result)
                : { label: "(Executing...)", color: "dimSeparator" as const };
              const statusColor = (colors as any)[statusInfo.color] || colors.success;

              return (
                <box
                  key={idx}
                  flexDirection="column"
                  paddingX={2}
                  paddingTop={idx === 0 ? 0 : 1}
                >
                  <box flexDirection="row" gap={1}>
                    <text attributes={TextAttributes.DIM}>
                      <em fg={colors.info}>{showReasoning ? "▼" : "▶"}</em>
                    </text>
                    <text attributes={TextAttributes.DIM}>
                      <em fg={colors.info}>⚡ {formatToolName(tc.name)}</em>
                    </text>
                    {tc.result ? (
                      <text fg={statusColor} attributes={TextAttributes.DIM}>
                        {statusInfo.label}
                      </text>
                    ) : (
                      <text
                        fg={colors.dimSeparator}
                        attributes={TextAttributes.DIM}
                      >
                        (Executing...)
                      </text>
                    )}
                  </box>

                  {showReasoning && (
                    <box flexDirection="column" paddingLeft={2} paddingTop={1}>
                      {parsedArgsObj && typeof parsedArgsObj === "object" ? (
                        <box flexDirection="column" gap={1}>
                          {Object.entries(parsedArgsObj).map(([key, value]) => {
                            const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
                            const isComplex = typeof value === "object" && value !== null;
                            
                            return (
                              <box key={key} flexDirection="column">
                                <text attributes={TextAttributes.DIM} fg={colors.primary}>
                                  {formattedKey}:
                                </text>
                                {isComplex ? (
                                  Array.isArray(value) ? (
                                    <box flexDirection="column" paddingLeft={2}>
                                      {value.map((item, i) => (
                                        <box key={i} flexDirection="row" gap={1}>
                                          <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>•</text>
                                          <text attributes={TextAttributes.DIM}>
                                            {typeof item === "object" ? JSON.stringify(item) : String(item)}
                                          </text>
                                        </box>
                                      ))}
                                    </box>
                                  ) : (
                                    <box paddingLeft={2}>
                                      <text attributes={TextAttributes.DIM}>
                                        {JSON.stringify(value, null, 2)}
                                      </text>
                                    </box>
                                  )
                                ) : (
                                  <box paddingLeft={2}>
                                    <text attributes={TextAttributes.DIM}>
                                      {String(value)}
                                    </text>
                                  </box>
                                )}
                              </box>
                            );
                          })}
                        </box>
                      ) : (
                        <text
                          // fg={colors.dimSeparator}
                          attributes={TextAttributes.DIM}
                        >
                          {String(rawArgs)}
                        </text>
                      )}

                      {tc.result ? (
                        <box paddingTop={1} flexDirection="column">
                          <text fg={statusColor} attributes={TextAttributes.DIM}>Result:</text>
                          <box paddingLeft={2}>
                            <text fg={colors.dimSeparator} attributes={TextAttributes.DIM}>
                              {typeof tc.result === "string" && tc.result.length > 500
                                ? tc.result.slice(0, 500) + "..."
                                : String(tc.result)}
                            </text>
                          </box>
                        </box>
                      ) : null}
                    </box>
                  )}
                </box>
              );
              })}
            </box>
          );
        })()}
      </box>
      {!hideFooter && (
        <box paddingX={3} paddingBottom={1} gap={1} width="100%">
          <box flexDirection="row" gap={2}>
            <text fg={mode == Mode.PLAN ? colors.planMode : colors.primary}>
              ◉
            </text>
            <box flexDirection="row" gap={1}>
              <text>{mode == Mode.PLAN ? "Plan" : "Build"}</text>
              <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
                &gt;
              </text>
              <text attributes={TextAttributes.DIM}>
                {model}
                {isReasoningModel && formattedEffort
                  ? ` (${formattedEffort})`
                  : ""}
              </text>
              {duration ? (
                <>
                  <text
                    attributes={TextAttributes.DIM}
                    fg={colors.dimSeparator}
                  >
                    &gt;
                  </text>
                  <text attributes={TextAttributes.DIM}>
                    {prettyMilliseconds(duration)}
                  </text>
                </>
              ) : null}
              {status === "INTERRUPTED" && (
                <>
                  <text
                    attributes={TextAttributes.DIM}
                    fg={colors.dimSeparator}
                  >
                    &gt;
                  </text>
                  <text attributes={TextAttributes.DIM}>interrupted</text>
                </>
              )}
            </box>
          </box>
        </box>
      )}
    </box>
  );
};
