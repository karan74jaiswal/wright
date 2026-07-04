## Building a Terminal AI Coding Agent (Wright)
You have an empty Bun monorepo that we want to setup for a new project I'm building. That project is an AI terminal coding agent—a Claude Code alternative named "Wright". 

### Business Case & Project Vision
This project aims to deliver a production-ready, highly extensible AI developer tool that challenges existing proprietary solutions like Cursor and Claude Code. 
1. **Enterprise-Grade Customization:** Unlike generic production tools, this CLI is designed to seamlessly integrate with custom enterprise workflows, proprietary themes, and internal security rules.
2. **SaaS Monetization Engine:** Built from the ground up as a fully functional Software-as-a-Service, featuring a robust, credits-based billing system (powered by Polar) to meter and monetize token usage effectively.
3. **Provider-Agnostic LLM Routing:** Eliminates vendor lock-in by using the Vercel AI SDK, allowing users and businesses to hot-swap between models (OpenAI, Anthropic, Mistral) based on cost and performance needs.

## Step 1 
For now we want to setup all the services needed for this. The Architecture looks as follows - 
 - **Terminal UI (Frontend)** - A CLI frontend built using Open Tui and React bindings for rendering components in the terminal.
 - **Backend Server** - A Hono-based backend server that handles API requests, real-time streaming (SSE), and business logic.
 - **Shared Package** - A shared types and schemas package for consistency across the monorepo.
 - **Database Layer** - A dedicated database package to manage state, users, and sessions.
 - **Billing (Polar)** - Integration with Polar for a credits-based SaaS billing system (metering token usage).
 - **Authentication (Clerk)** - Browser-to-CLI OAuth login flow.
 - **AI Router (Vercel AI SDK)** - Provider-agnostic model routing (supporting Haiku, Opus, GPT, etc.).

For now, let's initialize the foundational structure in the Bun monorepo (note: all code will live under the `packages/` directory, such as `packages/cli`, as we do not use an `apps` directory). We should also populate the steps to start the project locally in the README file and add `.env.example` files to all relevant packages.

## Step 2
**Terminal UI (CLI)** - 
Create a React-based TUI with a command menu. Add support for different agent modes:
- **Build Mode**: Agent has full access (read, write, edit, shell access).
- **Plan Mode**: Agent has read-only access (read, search).

Add foundational CLI commands like `/sessions` (to resume conversations), `/theme` (to switch color schemes), `/models` (to swap AI models), and `/login` (to handle Clerk auth). The agent responses should be streamed token-by-token with live reasoning on display.

**Backend** - 
Set up authentication logic using Clerk. Add the logic to talk to AI models via Vercel AI SDK and stream responses using Server-Sent Events (SSE). Integrate Polar to handle credit deductions based on the model and token usage. 

Whatever env variables are needed eventually (Clerk secrets, AI provider keys, Polar tokens), I will provide later, for now add them to `.env.example`.

By the end, also add commands in the top-level `package.json` to start the full project (frontend and backend) locally.
