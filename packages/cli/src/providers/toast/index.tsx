import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";

import { ToastVariant, type ToastOptions } from "./types";

import { DEFAULT_DURATION } from "./types";
import Toast from "../../components/toast";

interface ToastContextValue {
  show: (options: ToastOptions) => void;
}
const ToastContext = createContext<ToastContextValue | null>(null);

const ToastProvider = ({ children }: PropsWithChildren): ReactNode => {
  const [currentToast, setCurrentToast] = useState<ToastOptions | null>(null);
  const timoutHandleRef = useRef<NodeJS.Timeout | null>(null);

  const clearCurrentTimeout = useCallback(() => {
    if (timoutHandleRef.current) {
      clearTimeout(timoutHandleRef.current);
      timoutHandleRef.current = null;
    }
  }, []);

  const show = useCallback(
    (option: ToastOptions) => {
      const duration = option?.duration ?? DEFAULT_DURATION;

      clearCurrentTimeout();

      setCurrentToast({
        variant: option.variant ?? ToastVariant.INFO,
        message: option.message ?? "",
        duration,
      });

      timoutHandleRef.current = setTimeout(
        () => setCurrentToast(null),
        duration,
      ).unref();
    },
    [clearCurrentTimeout],
  );

  const value: ToastContextValue = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast currentToast={currentToast} />
    </ToastContext.Provider>
  );
};

const useToast = () => {
  const values = useContext(ToastContext);
  if (!values) throw new Error("useToast Must be used within a Toast Provider");

  return values;
};

export type { ToastContextValue };
export default ToastProvider;

export { useToast };
