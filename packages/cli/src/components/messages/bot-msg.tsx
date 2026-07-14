import { TextAttributes } from "@opentui/core";
import { useTheme } from "../../providers/theme";
import { MarkdownViewer } from "../markdown-viewer";

export interface BotMsgProps {
  content: string;
  model: string;
  reasoning?: string;
  toolCalls?: Record<string, { name: string; args: string; result?: any }>;
  streaming?: boolean;
}

export const BotMsg = ({
  content,
  model,
  reasoning,
  toolCalls,
  streaming = false,
}: BotMsgProps) => {
  const { colors } = useTheme();

  return (
    <box width="100%" alignItems="flex-start" flexDirection="column">
      <box paddingY={1} width="100%" flexDirection="column">
        {reasoning ? (
          <box paddingX={3} width="100%" paddingBottom={1}>
            <text fg={colors.dimSeparator} attributes={TextAttributes.ITALIC}>
              {reasoning}
            </text>
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
          <text fg={colors.primary}>◉</text>
          <text>{model}</text>
        </box>
      </box>
    </box>
  );
};
