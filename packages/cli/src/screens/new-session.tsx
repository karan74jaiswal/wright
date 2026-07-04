import { useLocation, useNavigate } from "react-router";
import { useEffect } from "react";

import { ErrorMsg, BotMsg, UserMsg } from "../components/messages";
import SessionShell from "../components/session-shell";

const NewSession = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { message?: string } | null;

  //   const [msgs, setMsgs] = useState([]);
  //   const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!state?.message)
      navigate("/", {
        replace: true,
      });
  }, [state, navigate]);

  if (!state?.message) return null;

  const handleSubmit = (msg: string) => {};

  return (
    <SessionShell onSubmit={handleSubmit} inputDisabled loading>
      <UserMsg message={state.message} />
      <BotMsg
        content="This is a sample bot response to demonstrate"
        model="opus-4-8"
      />
      <ErrorMsg message="Some Error" />
    </SessionShell>
  );
};

export default NewSession;
