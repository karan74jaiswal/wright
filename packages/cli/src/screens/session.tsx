import { InputBar } from "../components/input-bar";
import { useLocation, useNavigate, useParams } from "react-router";
import { useCallback, useEffect } from "react";
import { useTheme } from "../providers/theme";
import SessionShell from "../components/session-shell";

const Session = () => {
  const { colors } = useTheme();
  const { id } = useParams();
  const navigate = useNavigate();

  return <SessionShell onSubmit={(text: string) => {}} inputDisabled loading />;
};

export default Session;
