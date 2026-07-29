import { useCallback, useRef } from "react";
import { format } from "date-fns";
import { useDialog } from "../providers/dialog";
import DialogSearchList from "../components/dialog/dialog-search-list";
import { useTRPC } from "../lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@wright/api-gateway";
import Spinner from "../components/spinner";

type SessionsList = inferRouterOutputs<AppRouter>["session"]["listSessions"];
type SessionItem = SessionsList[number];

export default function SessionsDialog() {
  const trpc = useTRPC();
  const { data: sessions = [], isLoading } = useQuery(
    trpc.session.listSessions.queryOptions(),
  );
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

  const handleHighlight = useCallback((session: SessionItem) => {
    // TODO: add highlight logic
  }, []);

  if (isLoading) {
    return (
      <box padding={2} justifyContent="center" alignItems="center" gap={1}>
        <Spinner />
        <text>Fetching sessions...</text>
      </box>
    );
  }

  return (
    <DialogSearchList
      items={sessions}
      onSelect={handleSelect}
      onHighlight={handleHighlight}
      getKey={(session) => session.id}
      placeholder="Search Sessions..."
      emptyText="No matching Sessions"
      filterFn={(session, query) =>
        session.title.toLowerCase().includes(query.toLowerCase()) ||
        session.id.toLowerCase().includes(query)
      }
      renderItem={(session, isSelected) => (
        <box flexDirection="row" width="100%" justifyContent="space-between" paddingRight={1}>
          <text selectable={false} fg={isSelected ? "black" : "white"}>
            {isSelected ? "\u0020\u2022\u0020" : "\u0020\u0020\u0020"}
            {session.title}
          </text>
          <text selectable={false} fg={isSelected ? "black" : "gray"}>
            {format(new Date(session.createdAt), "hh:mm a")}
          </text>
        </box>
      )}
    />
  );
}
