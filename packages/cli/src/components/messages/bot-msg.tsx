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
}: BotMsgProps) => {
  const { colors } = useTheme();
  const { currentModel, reasoningEffort } = usePromptConfig();

  const isReasoningModel = 
    model.startsWith("o1") || 
    model.startsWith("o3") || 
    model.startsWith("o4") || 
    model.startsWith("gpt-5") ||
    model.startsWith("gemini-3") || 
    model.startsWith("gemini-2.5") || 
    model.startsWith("gemini-2.0-flash-thinking");

  const formattedEffort = reasoningEffort.charAt(0).toUpperCase() + reasoningEffort.slice(1);

  return (
    <box width="100%" alignItems="flex-start" flexDirection="column">
      <box paddingY={1} width="100%" flexDirection="column">
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

        {toolCalls && Object.values(toolCalls).length > 0 ? (
          <box
            paddingX={3}
            width="100%"
            paddingBottom={1}
            flexDirection="column"
          >
            {Object.values(toolCalls).map((tc, idx) => {
              let parsedArgs = tc.args;
              try {
                if (typeof tc.args === "string") {
                  parsedArgs = JSON.stringify(JSON.parse(tc.args), null, 2);
                } else if (typeof tc.args === "object" && tc.args !== null) {
                  parsedArgs = JSON.stringify(tc.args, null, 2);
                }
              } catch (e) {
                // Keep raw string if JSON parsing fails (e.g., during streaming)
              }

              return (
                <box key={idx} flexDirection="column" paddingBottom={1}>
                  <box flexDirection="row">
                    <text fg={colors.primary}>⚡ {tc.name}</text>
                    {tc.result ? (
                      <text fg={colors.success}> ✓</text>
                    ) : (
                      <text fg={colors.dimSeparator}> ...</text>
                    )}
                  </box>
                  {parsedArgs ? (
                    <box paddingLeft={2} paddingTop={1}>
                      <text
                        fg={colors.dimSeparator}
                        attributes={TextAttributes.DIM}
                      >
                        {String(parsedArgs)}
                      </text>
                    </box>
                  ) : null}
                </box>
              );
            })}
          </box>
        ) : null}

        {content ? (
          <box paddingX={3} width="100%">
            <MarkdownViewer content={content} streaming={streaming} />
          </box>
        ) : null}
      </box>
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
              {model === currentModel && isReasoningModel ? ` (${formattedEffort})` : ""}
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
    </box>
  );
};
