import { Outlet } from "react-router";
import KeyBoardProvider from "../providers/keyboard";
import DialogProvider from "../providers/dialog";
import ToastProvider from "../providers/toast";
import ThemedRoot from "./themed-root";
import ThemeProvider from "../providers/theme";
export default function RootLayout() {
  return (
    <ThemeProvider>
      <KeyBoardProvider>
        <DialogProvider>
          <ToastProvider>
            <ThemedRoot>
              <Outlet />
            </ThemedRoot>
          </ToastProvider>
        </DialogProvider>
      </KeyBoardProvider>
    </ThemeProvider>
  );
}
