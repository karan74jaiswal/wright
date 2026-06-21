import { createCliRenderer, ConsolePosition } from "@opentui/core";
import { createRoot } from "@opentui/react";

import Header from "./components/header";

import { InputBar } from "./components/input-bar";

function App() {
  return (
    <box
      alignItems="center"
      justifyContent="center"
      height="100%"
      width="100%"
      backgroundColor="#0D0D12"
      flexGrow={1}
      gap={2}
    >
      <Header />
      <box width="100%" maxWidth="95%" paddingX={2}>
        <InputBar
          onSubmit={(text: string) => {
            // console.log("This appears in the overlay");
          }}
        />
      </box>
    </box>
  );
}

const renderer = await createCliRenderer({
  onDestroy: () => {
    console.log("Renderer destroyed, performing additional cleanup...");
    process.exit(0);
  },

  consoleOptions: {
    position: ConsolePosition.BOTTOM,
    sizePercent: 30,
  },

  targetFps: 60,
  exitOnCtrlC: false,
});

createRoot(renderer).render(<App />);
