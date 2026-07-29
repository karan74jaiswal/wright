import { Outlet } from "react-router";
import KeyBoardProvider from "../providers/keyboard";
import DialogProvider from "../providers/dialog";
import ToastProvider from "../providers/toast";
import ThemedRoot from "./themed-root";
import ThemeProvider from "../providers/theme";
import PromptConfigProvider from "../providers/prompt-config";
export default function RootLayout() {
  return (
    <ThemeProvider>
      <PromptConfigProvider>
        <KeyBoardProvider>
          <DialogProvider>
            <ToastProvider>
              <ThemedRoot>
                <Outlet />
              </ThemedRoot>
            </ToastProvider>
          </DialogProvider>
        </KeyBoardProvider>
      </PromptConfigProvider>
    </ThemeProvider>
  );
}
