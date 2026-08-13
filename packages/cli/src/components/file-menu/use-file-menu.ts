import { useState, useCallback, useRef, useEffect } from "react";
import { useKeyboardLayer } from "../../providers/keyboard";
import { workspaceScanner } from "../../lib/scanner";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent, ScrollBoxRenderable } from "@opentui/core";

const MAX_CANDIDATES = 32;

// Simple sub-sequence fuzzy match
function fuzzyMatch(str: string, query: string): boolean {
  if (!query) return true;
  const s = str.toLowerCase();
  const q = query.toLowerCase();
  let qIdx = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === q[qIdx]) {
      qIdx++;
      if (qIdx === q.length) return true;
    }
  }
  return false;
}

export function useFileMenu() {
  const { isTopLayer, push, pop } = useKeyboardLayer();

  const [showFileMenu, setShowFileMenu] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollRef = useRef<ScrollBoxRenderable>(null);

  const [candidates, setCandidates] = useState<string[]>([]);
  const lastQueryRef = useRef("");

  const close = useCallback(() => {
    setShowFileMenu(false);
    pop("mention");
  }, [pop]);

  const handleContentChange = useCallback(
    (text: string) => {
      // Match either a quoted string (with spaces) or unquoted string (no spaces)
      const match = text.match(/(?:^|\s)@(?:"([^"]*)"?|([a-zA-Z0-9.\-_/]*))$/);

      if (match) {
        const query = (match[1] !== undefined ? match[1] : match[2]) || "";
        setFileQuery(query);
        if (!showFileMenu) {
          setShowFileMenu(true);
          push("mention", () => {
            close();
            return true;
          });
        }
      } else {
        close();
      }
    },
    [showFileMenu, push, close],
  );

  // Handle layer disabling from outside
  useEffect(() => {
    if (showFileMenu && !isTopLayer("mention")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowFileMenu(false);
    }
  }, [showFileMenu, isTopLayer]);

  // Compute candidates whenever query changes
  useEffect(() => {
    if (!showFileMenu) return;

    if (lastQueryRef.current === fileQuery && candidates.length > 0) return;
    lastQueryRef.current = fileQuery;

    let active = true;

    async function computeCandidates() {
      const cache = workspaceScanner.getCache();
      let newCandidates: string[];

      if (fileQuery.includes("/")) {
        const lastSlashIdx = fileQuery.lastIndexOf("/");
        const dirPath = fileQuery.substring(0, lastSlashIdx + 1);
        const search = fileQuery.substring(lastSlashIdx + 1);

        const isRoot = dirPath === "" || dirPath === "/";
        const dirFoundInCache = isRoot || cache.directories.includes(dirPath);

        let availablePaths: string[];
        if (dirFoundInCache) {
          availablePaths = [
            ...cache.directories.filter(
              (d) =>
                d.startsWith(dirPath) &&
                d !== dirPath &&
                d.substring(dirPath.length).split("/").filter(Boolean)
                  .length === 1,
            ),
            ...cache.files.filter(
              (f) =>
                f.startsWith(dirPath) &&
                !f.substring(dirPath.length).includes("/"),
            ),
          ];
        } else {
          const lazyResults = await workspaceScanner.readDirLazy(dirPath);
          availablePaths = lazyResults.map((p) => dirPath + p);
        }

        if (search) {
          newCandidates = availablePaths.filter((p) =>
            fuzzyMatch(p.substring(dirPath.length), search),
          );
        } else {
          newCandidates = availablePaths;
        }
      } else {
        const allPaths = [...cache.directories, ...cache.files];
        newCandidates = allPaths.filter((p) => fuzzyMatch(p, fileQuery));
      }

      if (active) {
        setCandidates(newCandidates.slice(0, MAX_CANDIDATES));
        setSelectedIndex(0);
      }
    }

    computeCandidates();

    return () => {
      active = false;
    };
  }, [fileQuery, showFileMenu, candidates.length]);

  const resolveFile = useCallback(
    (index: number) => {
      return candidates[index];
    },
    [candidates],
  );

  useKeyboard((e: KeyEvent) => {
    if (!showFileMenu || !isTopLayer("mention")) return;

    if (e.name === "escape") close();

    if (e.name === "down") {
      setSelectedIndex((i) => {
        if (candidates.length === 0) return 0;
        const newIndex = Math.min(candidates.length - 1, i + 1);
        if (scrollRef.current) {
          const visibleEnd =
            scrollRef.current.scrollTop + scrollRef.current.viewport.height - 1;
          if (newIndex > visibleEnd)
            scrollRef.current.scrollTo(
              newIndex - scrollRef.current.viewport.height + 1,
            );
        }
        return newIndex;
      });
    }
    if (e.name === "up") {
      setSelectedIndex((i) => {
        const newIndex = Math.max(0, i - 1);
        if (scrollRef.current && newIndex < scrollRef.current.scrollTop)
          scrollRef.current.scrollTo(newIndex);
        return newIndex;
      });
    }
  });

  return {
    showFileMenu,
    fileQuery,
    selectedIndex,
    scrollRef,
    candidates,
    handleContentChange,
    resolveFile,
    setSelectedIndex,
    close,
  };
}
