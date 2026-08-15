<!-- intent-skills:start -->

## Skill Loading

Before editing files for a substantial task:

- Run `bunx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `bunx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

## Project Context (Wright)

You are working on **Wright**, an AI Agent CLI & Microservices monorepo.
When starting a new session or debugging an issue, please read the architectural documentation in `docs/specs/*.md`.

**Critical Architecture to Know (See Docs folder for all modules documentation):**

- **Frontend (`@wright/cli`)**: Terminal UI built with React/OpenTUI. Uses the `useChat` hook to sync live SSE streaming state with the official PostgreSQL database state via React Query `invalidateQueries`.
- **Backend (`@wright/chat-service` & `@wright/api-gateway`)**: Microservices using Express and tRPC. Exposes `tRPC` subscriptions via Server-Sent Events (SSE).
- **Agent (`@wright/agent`)**: Powered by LangGraph. Uses `streamEvents` to emit custom `ChatStreamEvent` payloads. State is persisted natively using `@langchain/langgraph-checkpoint-postgres`.
- **Interruption Flow**: Pressing ESC in the UI aborts the network request. The backend catches the `AbortError`, saves the partial message as `INTERRUPTED` to PostgreSQL, but lets LangGraph roll back its context to prevent memory corruption.
- **Database (`@wright/database`)**: PostgreSQL via Prisma.

Always ensure you understand the flow of events across these 5 packages before making breaking changes to the state management or streaming protocols.

## Git Operations

- **CRITICAL**: Do NOT run or ask to run `git add`, `git commit`, or `git push` automatically. Only perform these actions when explicitly ordered or requested by the user.

## Explicit Planning

- **CRITICAL**: If the user explicitly asks for a plan first before execution, you MUST ONLY perform read operations (explore codebase, read files) to formulate a detailed step-by-step plan. DO NOT execute any state-mutating tasks (create, edit, delete files or run destructive commands) until the user explicitly approves the plan in a subsequent prompt.

When writing code that uses LangGraph (e.g., interrupts, fault tolerance), ALWAYS verify your understanding by querying the LangChain documentation using the `docs-langchain` MCP server.

## Strict Skill Usage Rules (OpenTUI & Clerk)

- **CRITICAL**: For ANY changes, implementations, or issues related to **OpenTUI** (including `TestRenderer`), you MUST read and follow the `opentui` skill instructions (`view_file` on `SKILL.md`). Do NOT make assumptions about OpenTUI behavior, props, or API.
- **CRITICAL**: For ANY changes, implementations, or issues related to **Clerk** (including FAPI, tokens, PKCE, login flows), you MUST consult the relevant `clerk-*` skills (e.g., `clerk`, `clerk-cli`, etc.). Do NOT make assumptions about Clerk's OAuth flows or API endpoints without verifying them against the skills.
