import { useCallback, useRef, useEffect, useState } from "react";

import { useDialog } from "../providers/dialog";

import DialogSearchList from "../components/dialog/dialog-search-list";
import type { InferResponseType } from "hono";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/https-errors";

type SessionsList = InferResponseType<(typeof apiClient.sessions)["$get"], 200>;
export default function SessionsDialog() {
  const [sessions, setSessions] = useState<SessionsList>([]);
  const { close } = useDialog();

  useEffect(() => {
    async function fetchSessionList() {
      try {
        const res = await apiClient.sessions.$get();
        if (!res.ok) throw new Error(await getErrorMessage(res));
      } catch (err) {}
    }
  });
  const handleSelect = useCallback(
    (theme: Theme) => {
      confirmedRef.current = true;
      setTheme(theme);
      close();
    },
    [close, setTheme],
  );

  const handleHighlight = useCallback(
    (theme: Theme) => setTheme(theme),
    [setTheme],
  );

  return (
    <DialogSearchList
      items={sessions}
      onSelect={handleSelect}
      onHighlight={handleHighlight}
      getKey={(session) => session.id}
      placeholder="Search Sessions..."
      emptyText="No matching Sessions"
      filterFn={(session, query) =>
        session.title.toLowerCase().includes(query.toLowerCase())
      }
      renderItem={(theme, isSelected) => (
        <text selectable={false} fg={isSelected ? "black" : "white"}>
          {theme.name === currentTheme.name
            ? "\u0020\u2022\u0020"
            : "\u0020\u0020\u0020"}
          {theme.name}
        </text>
      )}
    />
  );
}
