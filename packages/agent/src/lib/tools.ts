import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { interrupt } from "@langchain/langgraph";

// Dummy tools for bare minimum implementation
export const dummySearch = tool(
  async ({ query }) => {
    return `Searched for: ${query}. Found nothing yet.`;
  },
  {
    name: "dummy_search",
    description: "Search the web for current information.",
    schema: z.object({
      query: z.string().describe("The search query"),
    }),
  }
);

// Ask for permission tool
export const askPermission = tool(
  async ({ target, reason }) => {
    // We pause execution and return the payload to the frontend.
    // The frontend will send a Command({ resume: "Approve" }) or "Reject".
    const humanDecision = interrupt({
      type: "ask_permission",
      target,
      reason,
    });
    return String(humanDecision);
  },
  {
    name: "ask_permission",
    description: "Ask the user for permission to execute a dangerous action (like running a command or deleting a file).",
    schema: z.object({
      target: z.string().describe("The exact command or action you want to execute"),
      reason: z.string().describe("Why you need to execute this action"),
    }),
  }
);

// Ask multiple choice question tool
export const askQuestion = tool(
  async ({ question, options, isMultiSelect }) => {
    const humanDecision = interrupt({
      type: "ask_question",
      question,
      options,
      isMultiSelect
    });
    return String(humanDecision);
  },
  {
    name: "ask_question",
    description: "Ask the user a multiple-choice question to clarify requirements, solicit feedback, or pick an option.",
    schema: z.object({
      question: z.string().describe("The question to ask"),
      options: z.array(z.string()).describe("The options to present to the user"),
      isMultiSelect: z.boolean().optional().describe("If true, the user can select multiple options"),
    })
  }
);
