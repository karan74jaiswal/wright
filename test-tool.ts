import { ToolMessage } from "@langchain/core/messages";
const t = new ToolMessage({ content: "hello", tool_call_id: "123" });
console.log(JSON.stringify(t, null, 2));
