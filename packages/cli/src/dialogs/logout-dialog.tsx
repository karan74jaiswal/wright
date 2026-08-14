import React from "react";
import { useKeyboard } from "@opentui/react";
import { useAuth } from "../providers/auth-provider";
import { useDialog } from "../providers/dialog";

export function LogoutDialog() {
  const { login, acknowledgeRemoteLogout } = useAuth();
  const dialog = useDialog();

  useKeyboard((e) => {
    if (e.name === "y") {
      acknowledgeRemoteLogout();
      dialog.close();
      login();
    } else if (e.name === "n" || e.name === "escape") {
      acknowledgeRemoteLogout();
      dialog.close();
    }
  });

  return (
    <box flexDirection="column" padding={1} gap={1}>
      <text>You have been logged out remotely. Would you like to login again?</text>
      <box flexDirection="row" gap={2}>
        <text fg="gray">[Y] Yes</text>
        <text fg="gray">[N] No</text>
      </box>
    </box>
  );
}
