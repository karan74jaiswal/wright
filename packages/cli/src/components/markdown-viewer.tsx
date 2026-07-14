import { useMemo } from "react";
import {
  RGBA,
  SyntaxStyle,
  BoxRenderable,
  CodeRenderable,
  TextRenderable,
} from "@opentui/core";
import type { RenderNodeContext } from "@opentui/core";
import { useRenderer } from "@opentui/react";
import { useTheme } from "../providers/theme";

export interface MarkdownViewerProps {
  content: string;
  streaming?: boolean;
}

export const MarkdownViewer = ({ content, streaming }: MarkdownViewerProps) => {
  const { colors } = useTheme();
  const renderer = useRenderer();

  const syntaxStyle = useMemo(() => {
    return SyntaxStyle.fromStyles({
      // Base tokens
      string: { fg: RGBA.fromHex(colors.success) },
      keyword: { fg: RGBA.fromHex(colors.planMode) },
      function: { fg: RGBA.fromHex(colors.selection) },
      comment: { fg: RGBA.fromHex(colors.dimSeparator), italic: true },
      number: { fg: RGBA.fromHex(colors.info) },
      boolean: { fg: RGBA.fromHex(colors.info) },
      type: { fg: RGBA.fromHex(colors.primary) },
      variable: { fg: RGBA.fromHex(colors.selection) },
      operator: { fg: RGBA.fromHex(colors.planMode) },
      punctuation: { fg: RGBA.fromHex(colors.dimSeparator) },

      // Markdown-specific tokens
      "markup.heading": { fg: RGBA.fromHex(colors.primary), bold: true },
      "markup.heading.1": {
        fg: RGBA.fromHex(colors.primary),
        bold: true,
        underline: true,
      },
      "markup.heading.2": { fg: RGBA.fromHex(colors.info), bold: true },
      "markup.bold": { bold: true },
      "markup.strong": { bold: true },
      "markup.italic": { italic: true },
      "markup.list": { fg: RGBA.fromHex(colors.primary) },
      "markup.quote": { fg: RGBA.fromHex(colors.dimSeparator), italic: true },
      "markup.raw": { fg: RGBA.fromHex(colors.success) },
      "markup.raw.block": { fg: RGBA.fromHex(colors.success) },
      "markup.link": { fg: RGBA.fromHex(colors.info), underline: true },
      "markup.link.url": {
        fg: RGBA.fromHex(colors.dimSeparator),
        underline: true,
      },

      // default: { fg: RGBA.fromHex(colors.planMode) },
    });
  }, [colors]);

  const customRenderNode = useMemo(() => {
    return (token: any, context: RenderNodeContext) => {
      if (token.type === "code") {
        const language = token.lang ? token.lang.trim().split(" ")[0] : "text";

        const container = new BoxRenderable(renderer, {
          border: true,
          borderStyle: "rounded",
          borderColor: colors.dimSeparator,
          flexDirection: "column",
          width: "100%",
          paddingX: 1,
          marginBottom: 1,
          marginTop: 1,
        });

        if (language && language !== "text") {
          const titleBox = new BoxRenderable(renderer, {
            width: "100%",
            paddingBottom: 1,
          });
          titleBox.add(
            new TextRenderable(renderer, {
              content: ` ${language.toUpperCase()} `,
              fg: colors.primary,
            }),
          );
          container.add(titleBox);
        }

        const codeBlock = new CodeRenderable(renderer, {
          content: (token.text || "").trimEnd(),
          filetype: language,
          syntaxStyle: syntaxStyle,
          width: "100%",
          selectable: true,
          selectionBg: colors.selection,
        });

        container.add(codeBlock);
        return container;
      }
      return undefined;
    };
  }, [colors, syntaxStyle, renderer]);

  let displayContent = content;

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      displayContent = parsed.map((block: any) => block.text || "").join("");
    } else if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.text === "string"
    ) {
      displayContent = parsed.text;
    }
  } catch (e) {
    if (displayContent.startsWith('[{"text":"')) {
      let stripped = displayContent.slice(10);

      if (stripped.endsWith('","type":"text"}]')) {
        stripped = stripped.slice(0, -17);
      } else if (stripped.endsWith('"}]')) {
        stripped = stripped.slice(0, -3);
      }

      try {
        displayContent = JSON.parse(`"${stripped}"`);
      } catch {
        displayContent = stripped.replace(/\\n/g, "\n").replace(/\\"/g, '"');
      }
    }
  }

  return (
    <markdown
      syntaxStyle={syntaxStyle}
      content={displayContent}
      streaming={streaming}
      renderNode={customRenderNode}
      tableOptions={{
        style: "grid",
        widthMode: "full",
        columnFitter: "balanced",
        wrapMode: "word",
        cellPadding: 1,
        borders: true,
        outerBorder: true,
        borderStyle: "rounded",
        borderColor: colors.dimSeparator,
        selectable: true,
      }}
    />
  );
};
