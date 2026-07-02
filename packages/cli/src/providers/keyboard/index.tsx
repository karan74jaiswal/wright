import {
  useState,
  useRef,
  useCallback,
  createContext,
  useContext,
  type PropsWithChildren,
  type ReactNode,
  type RefObject,
} from "react";
import { useKeyboard, useRenderer } from "@opentui/react";
import type { Responder } from "./types";
import type { KeyEvent } from "@opentui/core";

export interface KeyboardLayerContextValue {
  push: (id: string, responder?: Responder) => void;
  pop: (id: string) => void;
  isTopLayer: (id: string) => boolean;
  setResponder: (id: string, responder: Responder | null) => void;
}
const KeyboardContext = createContext<KeyboardLayerContextValue | null>(null);
interface KeyBoardProviderProps extends PropsWithChildren {}

const KeyBoardProvider = function ({
  children,
}: KeyBoardProviderProps): ReactNode {
  const [stack, setStack] = useState<string[]>(["base"]);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const responders = useRef<Map<string, Responder>>(new Map());
  const renderer = useRenderer();

  const push = useCallback((id: string, responder?: Responder) => {
    if (responder) responders.current.set(id, responder);
    setStack((prev: string[]) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  }, []);

  const pop = useCallback((id: string) => {
    responders.current.delete(id);
    setStack((prev) => prev.filter((layer) => layer !== id));
  }, []);

  const isTopLayer = useCallback(
    (id: string) => {
      return stack.length === 0 || stack[stack.length - 1] === id;
    },
    [stack],
  );

  const setResponder = useCallback(
    (id: string, responder: Responder | null) => {
      if (responder) responders.current.set(id, responder);
      else responders.current.delete(id);
    },
    [],
  );

  useKeyboard((key: KeyEvent) => {
    // console.log(stack);
    if (key.name === "t" && key.ctrl) {
      //  console.log(e);
      // renderer.console.activate();
      renderer.console.toggle();
      // console.log(stack);
    }
    if (key.ctrl && key.name === "c") {
      const currentStack = stackRef.current;
      for (let i = currentStack.length - 1; i >= 0; i--) {
        const layerId = currentStack[i]!;
        const responder = responders.current.get(layerId);

        if (responder && responder()) return;
      }
      renderer.destroy();
    }
  });

  const keyboardContextvalue: KeyboardLayerContextValue = {
    push,
    pop,
    isTopLayer,
    setResponder,
  };
  return (
    <KeyboardContext.Provider value={keyboardContextvalue}>
      {children}
    </KeyboardContext.Provider>
  );
};

const useKeyboardLayer = () => {
  const values = useContext(KeyboardContext);
  if (!values)
    throw new Error("useKeyboard Must be used within a Keyboard Provider");

  return values;
};

export default KeyBoardProvider;

export { useKeyboardLayer };
