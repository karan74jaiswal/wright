import { createCliRenderer, ConsolePosition } from "@opentui/core";
import { createRoot } from "@opentui/react";

import Header from "./components/header";

import { InputBar } from "./components/input-bar";
import ToastProvider from "./providers/toast";
import KeyBoardProvider from "./providers/keyboard";
import DialogProvider from "./providers/dialog";
import ThemeProvider, { useTheme } from "./providers/theme";
function ThemedRoot() {
  const { colors } = useTheme();
  return (
    <box
      alignItems="center"
      justifyContent="center"
      height="100%"
      width="100%"
      backgroundColor={colors.background}
      flexGrow={1}
      gap={2}
    >
      <Header />
      <box width="100%" maxWidth={78} paddingX={2}>
        <InputBar
          onSubmit={(text: string) => {
            // console.log("This appears in the overlay");
          }}
        />
      </box>
    </box>
  );
}

function App() {
  return (
    <ThemeProvider>
      <KeyBoardProvider>
        <DialogProvider>
          <ToastProvider>
            <ThemedRoot />
          </ToastProvider>
        </DialogProvider>
      </KeyBoardProvider>
    </ThemeProvider>
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
