import { TextAttributes } from "@opentui/core";
import type { JSX } from "@opentui/react/jsx-runtime";

export default function Header(): JSX.Element {
  return (
    <box justifyContent="center" alignItems="center">
      <box
        flexDirection="row"
        justifyContent="center"
        gap={0.5}
        alignItems="center"
      >
        <ascii-font
          font="slick"
          text="Flow"
          color={["#14B8A6", "#E2E8F0"]}
          backgroundColor="#020617"
        />
      </box>
    </box>
  );
}
