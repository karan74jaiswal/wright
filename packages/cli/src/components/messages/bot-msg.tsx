import { TextAttributes } from "@opentui/core";
import { useTheme } from "../../providers/theme";
import { MarkdownViewer } from "../markdown-viewer";
import { Mode } from "@wright/database/enums";
import prettyMilliseconds from "pretty-ms";
import ThinkingSpinner from "../thinking-spinner";
import { usePromptConfig } from "../../providers/prompt-config";

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
      <box paddingTop={hideHeader ? 0 : 1} paddingBottom={hideFooter ? 0 : 1} width="100%" flexDirection="column">
        {reasoning ? (
          <box
            paddingX={3}
            width="100%"
            paddingBottom={1}
            flexDirection="column"
            gap={showReasoning ? 1 : 0}
          >
            <box flexDirection="row" gap={1}>
              <text fg={colors.dimSeparator}>
                {showReasoning ? "▼" : "▶"}{" "}
                {streaming
                  ? "Thinking..."
                  : `Thought${reasoningDuration ? ` for ${prettyMilliseconds(reasoningDuration)}` : ""}`}
              </text>

              {streaming ? <ThinkingSpinner /> : null}
              <text attributes={TextAttributes.DIM}>
                {showReasoning
                  ? "(ctrl + o to collapse)"
                  : "(ctrl + o to expand)"}
              </text>
            </box>
            {showReasoning && (
              <text fg={colors.dimSeparator} attributes={TextAttributes.ITALIC}>
                {reasoning}
              </text>
            )}
          </box>
        ) : null}

        {content ? (
          <box paddingX={3} width="100%">
            <MarkdownViewer content={content} streaming={streaming} />
          </box>
        ) : null}

        {toolCalls && Object.values(toolCalls).length > 0 ? (
          <box
            paddingX={3}
            width="100%"
            paddingTop={content ? 1 : 0}
            paddingBottom={1}
            flexDirection="column"
          >
            {Object.values(toolCalls).map((tc, idx) => {
              let parsedArgsObj: Record<string, any> | null = null;
              let rawArgs = tc.args;
              try {
                parsedArgsObj =
                  typeof tc.args === "string" ? JSON.parse(tc.args) : tc.args;
              } catch (e) {
                // Keep raw string if JSON parsing fails
              }

              return (
                <box
                  key={idx}
                  flexDirection="column"
                  paddingBottom={showReasoning ? 1 : 0}
                >
                  <box flexDirection="row" gap={1}>
                    <text fg={colors.dimSeparator}>
                      {showReasoning ? "▼" : "▶"}
                    </text>
                    <text fg={colors.primary}>⚡ {tc.name}</text>
                    {tc.result ? (
                      <text fg={colors.success}> (Success)</text>
                    ) : (
                      <text fg={colors.dimSeparator}> (Executing...)</text>
                    )}
                  </box>

                  {showReasoning && (
                    <box flexDirection="column" paddingLeft={2} paddingTop={1}>
                      {parsedArgsObj && typeof parsedArgsObj === "object" ? (
                        Object.entries(parsedArgsObj).map(([key, value]) => {
                          let displayValue =
                            typeof value === "object"
                              ? JSON.stringify(value)
                              : String(value);
                          // Truncate long strings for UI sanity
                          if (displayValue.length > 200) {
                            displayValue = displayValue.slice(0, 200) + "...";
                          }
                          return (
                            <box key={key} flexDirection="row" gap={1}>
                              <text fg={colors.primary}>{key}:</text>
                              <text fg={colors.dimSeparator}>{displayValue}</text>
                            </box>
                          );
                        })
                      ) : (
                        <text
                          fg={colors.dimSeparator}
                          attributes={TextAttributes.DIM}
                        >
                          {String(rawArgs)}
                        </text>
                      )}

                      {tc.result && (
                        <box paddingTop={1} flexDirection="row" gap={1}>
                          <text fg={colors.success}>Result:</text>
                          <text fg={colors.dimSeparator}>
                            {typeof tc.result === "string" &&
                            tc.result.length > 200
                              ? tc.result.slice(0, 200) + "..."
                              : String(tc.result)}
                          </text>
                        </box>
                      )}
                    </box>
                  )}
                </box>
              );
            })}
          </box>
        ) : null}
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
              {duration && (
                <>
                  <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
                    &gt;
                  </text>
                  <text attributes={TextAttributes.DIM}>
                    {prettyMilliseconds(duration)}
                  </text>
                </>
              )}
              {status === "INTERRUPTED" && (
                <>
                  <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
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
