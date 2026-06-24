import { TextAttributes, type ASCIIFontName } from "@opentui/core";
import type { JSX } from "@opentui/react/jsx-runtime";

export default function Header(): JSX.Element {
  return (
    <box justifyContent="center" alignItems="center">
      <box
        flexDirection="column"
        justifyContent="center"
        gap={0.5}
        alignItems="center"
      >
        <ascii-font
          font="tiny"
          text="wright"
          color={["#14B8A6", "#E2E8F0"]}
          backgroundColor="#020617"
        />
      </box>
    </box>
  );
}
