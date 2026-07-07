import { useCallback, useRef } from "react";
import { useDialog } from "../providers/dialog";
import DialogSearchList from "../components/dialog/dialog-search-list";
import { trpc } from "../lib/api-client";
import { useNavigate } from "react-router";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@wright/api-gateway";

type SessionsList = inferRouterOutputs<AppRouter>["session"]["listSessions"];
type SessionItem = SessionsList[number];

export default function SessionsDialog() {
  const { data: sessions = [] } = trpc.session.listSessions.useQuery();
  const { close } = useDialog();
  const confirmedRef = useRef(false);

  const navigate = useNavigate();

  const handleSelect = useCallback(
    (session: SessionItem) => {
      confirmedRef.current = true;
      navigate(`/sessions/${session.id}`);
      close();
    },
    [close, navigate],
  );

  const handleHighlight = useCallback(
    (session: SessionItem) => {
      // TODO: add highlight logic
    },
    [],
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
      renderItem={(session, isSelected) => (
        <text selectable={false} fg={isSelected ? "black" : "white"}>
          {isSelected
            ? "\u0020\u2022\u0020"
            : "\u0020\u0020\u0020"}
          {session.title}
        </text>
      )}
    />
  );
}
