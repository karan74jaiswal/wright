import {
  useState,
  useCallback,
  createContext,
  useContext,
  type PropsWithChildren,
  type ReactNode,
} from "react";

import { useKeyboardLayer } from "../keyboard";

import type { DialogConfig } from "./types";
import Dialog from "../../components/dialog";

export interface DialogContextValue {
  open: (config: DialogConfig) => void;
  close: () => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

const DialogProvider = function ({ children }: PropsWithChildren): ReactNode {
  const [currentDialog, setCurrentDialog] = useState<DialogConfig | null>(null);
  const { push, pop } = useKeyboardLayer();

  const close = useCallback(() => {
    setCurrentDialog(null);
    pop("dialog");
  }, [pop]);

  const open = useCallback(
    (config: DialogConfig) => {
      setCurrentDialog(config);
      push("dialog", () => {
        close();
        return true;
      });
    },
    [push, close],
  );

  const dialogContextValues: DialogContextValue = {
    open,
    close,
  };
  return (
    <DialogContext.Provider value={dialogContextValues}>
      {children}
      <Dialog currentDialog={currentDialog} close={close} />
    </DialogContext.Provider>
  );
};

const useDialog = () => {
  const values = useContext(DialogContext);
  if (!values)
    throw new Error("useDialog Must be used within a Dialog Provider");
  return values;
};

export default DialogProvider;

export { useDialog };
