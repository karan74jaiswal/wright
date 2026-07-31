import { ToolMessage } from "@langchain/core/messages";
const msg = new ToolMessage({ content: "test", tool_call_id: "1", status: "error" });
console.log(msg.status);
