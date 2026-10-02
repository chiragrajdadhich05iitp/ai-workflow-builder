# NextFlow

A visual LLM workflow builder. Wire up AI nodes on a drag-and-drop canvas, execute the graph in parallel, and watch results stream back in real time.

Built as a Galaxy.ai-style DAG editor restricted to LLM and image-processing workflows. All execution runs inside [Trigger.dev](https://trigger.dev) managed tasks — never inside Vercel serverless functions.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Canvas | React Flow 11 |
| State | Zustand 4 + Zundo (undo/redo) |
| Auth | Clerk 5 |
| Database | PostgreSQL via Neon, Prisma ORM 5 |
| Task orchestration | Trigger.dev 3 |
| AI | Google Generative AI (Gemini) |
| Image processing | FFmpeg (Trigger.dev extension) |
| File upload | Uppy 3 + Transloadit |
| UI | Radix UI + Tailwind CSS |
| Validation | Zod |

---

## Features

- **Visual DAG editor** — drag nodes from a picker, draw typed edges, undo/redo canvas changes
- **Four node types** — Request Inputs, Crop Image, Gemini, Response (see below)
- **Parallel execution** — sibling nodes fan out concurrently via promise memoisation
- **Selective re-runs** — re-run a single node or a subset, reading cached outputs for skipped upstreams
- **Realtime status** — pulsating glow per node driven by Trigger.dev Realtime SDK
- **Run history** — paginated timeline with per-node inputs, outputs, errors, and durations
- **Auto-save** — debounced PATCH with optimistic concurrency (version field) and multi-tab conflict detection
- **Direct file upload** — images upload straight to Transloadit from the browser; no proxy

---

## Node Types

| Type | Stable ID | Deletable | Executed by |
|------|-----------|-----------|-------------|
| Request Inputs | `n_request_inputs` | No | Inline (resolves field values) |
| Crop Image | `n_crop_<cuid>` | Yes | `node.cropImage` Trigger.dev task |
| Gemini | `n_gemini_<cuid>` | Yes | `node.gemini` Trigger.dev task |
| Response | `n_response` | No | Inline (captures final output) |

---

## Architecture

```
Browser (React Flow canvas + Zustand)
  ├── Trigger.dev Realtime hook  →  live node-status pushes
  └── Transloadit direct upload  →  HMAC-signed by /api/upload/signature
           │
           ▼
Next.js server (Vercel / App Router)
  ├── /api/workflows/**          →  CRUD + run dispatch
  ├── /api/upload/signature      →  Transloadit HMAC signing
  ├── Clerk middleware            →  auth on every non-public route
  └── Prisma ORM                 →  Neon Postgres
           │
           │  tasks.trigger() / tasks.triggerAndWait()
           ▼
Trigger.dev (managed, long-running tasks)
  ├── workflow.execute            →  DAG orchestrator (promise fan-out)
  ├── node.cropImage              →  FFmpeg crop + mandatory 30 s wait
  └── node.gemini                 →  Gemini multimodal inference
           │
           │  Realtime events (run:<id>, node:<id> tags)
           └──────────────────────────────────────────► Browser
```

**Hard rule:** Gemini calls and FFmpeg operations run exclusively in Trigger.dev tasks. They are never invoked from an API route.

### Full-run request flow

1. User clicks **Run All** → `POST /api/workflows/:id/runs` (`scope: "FULL"`)
2. API creates a `WorkflowRun` row, dispatches `workflow.execute`, and mints a scoped Public Access Token (PAT)
3. Browser receives `{ runId, publicAccessToken }` and subscribes via `useRealtimeRunsWithTag`
4. `workflow.execute` builds the subgraph and starts a memoised Promise fan-out, calling `tasks.triggerAndWait` for each `crop_image` / `gemini` node — tagging each child `run:<runId>` and `node:<nodeId>`
5. Realtime events arrive in the browser → node status updates → CSS pulsating glow
6. Orchestrator persists `NodeRun` rows and rolls up the final `WorkflowRun.status`

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) Postgres database
- A [Clerk](https://clerk.com) application
- A [Trigger.dev](https://trigger.dev) project
- A [Google AI](https://aistudio.google.com) API key (Gemini)
- A [Transloadit](https://transloadit.com) account with an upload template

### Install

```bash
git clone <repo-url>
cd nextflow
npm install
```

### Configure environment

```bash
cp .env.example .env.local
# Edit .env.local and fill in every value
```

See [Environment Variables](#environment-variables) for the full reference.

> **Note:** `GOOGLE_AI_API_KEY` and all `TRANSLOADIT_*` variables must **also** be added to your Trigger.dev project's environment settings — they are read inside task containers, not by the Next.js process.

### Set up the database

```bash
npm run db:generate   # generate Prisma client
npm run db:migrate    # deploy migrations to your Neon database
```

### Run in development

Open two terminals:

```bash
# Terminal 1 — Next.js dev server
npm run dev

# Terminal 2 — Trigger.dev worker (required for task execution)
npm run trigger:dev
```

The app will be available at `http://localhost:3000`. On first login, a sample workflow is seeded automatically.

---

## Environment Variables

All secrets live in `.env.local` (never committed). Copy from `.env.example`.

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (public) |
| `CLERK_SECRET_KEY` | Clerk secret key (server-only) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Sign-in route, default `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Sign-up route, default `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Redirect after sign-in, default `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Redirect after sign-up, default `/dashboard` |
| `DATABASE_URL` | Neon pooled connection string (include `?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL` | Neon direct connection string (used by Prisma migrations) |
| `TRIGGER_API_URL` | Trigger.dev API endpoint, default `https://api.trigger.dev` |
| `TRIGGER_SECRET_KEY` | Trigger.dev secret key |
| `TRIGGER_PROJECT_REF` | Trigger.dev project reference (from Project Settings) |
| `GOOGLE_AI_API_KEY` | Gemini API key — **also required in Trigger.dev env** |
| `TRANSLOADIT_AUTH_KEY` | Transloadit auth key — **also required in Trigger.dev env** |
| `TRANSLOADIT_AUTH_SECRET` | Transloadit auth secret — **also required in Trigger.dev env** |
| `TRANSLOADIT_TEMPLATE_ID_UPLOAD` | Transloadit upload template ID — **also required in Trigger.dev env** |
| `NEXT_PUBLIC_APP_URL` | Public URL of the app, e.g. `http://localhost:3000` |
| `NEXT_PUBLIC_CANDIDATE_LINKEDIN` | LinkedIn profile URL (logged to console on every page load) |

---

## Development Commands

```bash
npm run dev              # Next.js dev server (port 3000)
npm run trigger:dev      # Trigger.dev worker (required for run execution)
npm run build            # Production build
npm run start            # Production server
npm run typecheck        # TypeScript type-check (no emit)
npm run lint             # ESLint

npm run db:generate      # Regenerate Prisma client after schema changes
npm run db:migrate       # Deploy pending migrations (production / CI)
npm run db:migrate:dev   # Create + apply a new migration (development)
npm run db:studio        # Open Prisma Studio GUI
```

---

## Project Structure

```
nextflow/
├── app/
│   ├── (auth)/              # Public sign-in / sign-up pages (Clerk)
│   ├── (app)/
│   │   ├── dashboard/       # Workflow list; seeds sample workflow on first login
│   │   └── workflow/[id]/   # React Flow canvas editor
│   └── api/
│       ├── workflows/       # CRUD + run dispatch endpoints
│       └── upload/signature # Transloadit HMAC signing
│
├── components/
│   ├── canvas/
│   │   ├── nodes/           # RequestInputsNode, CropImageNode, GeminiNode, ResponseNode
│   │   ├── edges/           # AnimatedEdge
│   │   └── handles/         # TypedHandle (color-coded by data kind)
│   └── dashboard/           # WorkflowList, WorkflowCard, HistoryPanel, RunRow
│
├── lib/
│   ├── nodes/               # types.ts, schema.ts, defaults.ts, registry.ts, colors.ts
│   ├── store/               # workflowStore.ts (Zustand + Zundo)
│   ├── executor/            # buildSubgraph.ts, validateGraph.ts, detectCycle.ts
│   ├── gemini/              # Gemini client wrapper
│   ├── realtime/            # Tag helpers for Trigger.dev realtime
│   └── translo/             # Transloadit signing + upload helpers
│
├── trigger/
│   ├── client.ts            # Trigger.dev SDK client
│   ├── workflow.execute.ts  # DAG orchestrator
│   ├── node.cropImage.ts    # FFmpeg crop task
│   └── node.gemini.ts       # Gemini inference task
│
├── prisma/
│   ├── schema.prisma
│   └── seed/sampleWorkflow.ts
│
└── trigger.config.ts        # Node.js runtime, FFmpeg + Prisma extensions, 300 s max duration
```

---

## Data Model

| Model | Purpose |
|-------|---------|
| `User` | Clerk user record; `seededAt` tracks first-login sample workflow seed |
| `Workflow` | DAG definition: `nodes` (JSON), `edges` (JSON), `version` (optimistic concurrency) |
| `WorkflowRun` | Execution record: `scope` (FULL / PARTIAL / SINGLE), `status` (RUNNING / SUCCESS / FAILED / PARTIAL / CANCELLED) |
| `NodeRun` | Per-node execution: status, inputs, output, error message, duration |

---

## Key Concepts

### ConnectableValue

Every input on `CropImageData` and `GeminiData` uses:

```ts
{ value: T | null; connected: boolean }
```

When `connected: true`, an edge is wired to the handle — the UI disables manual input and the executor uses the edge-resolved value instead. The flag is derived from the edge list and kept in sync by `syncConnectedFlags()` in `workflowStore.ts` on every edge change.

The `vision` input on Gemini uses `MultiConnectableValue<string>` to accept multiple upstream image connections:

```ts
{ values: string[]; connectedFrom: string[] }
```

### DAG executor (promise memoisation)

`workflow.execute` uses a `Map<nodeId, Promise<outputs>>` to fan out in parallel without redundant executions:

```
start(nodeId):
  if memo.has(nodeId) → return cached promise (prevents duplicate execution)
  inputsReady = Promise.all(upstreamEdges.map(e => start(e.source)))
  p = inputsReady.then(inputs => runNode(node, inputs))
  memo.set(nodeId, p)
  return p
```

Sibling nodes at the same DAG level start as soon as their own upstreams resolve — they never block each other. After `Promise.allSettled`, any node whose promise was never started receives a `SKIPPED` `NodeRun` row.

### Auto-save and optimistic concurrency

The Zustand store debounces graph changes for 750 ms, then PATCHes `{ graph: { nodes, edges }, version }`. The server increments `version` on each write. A `409 VERSION_CONFLICT` response means another tab or client saved first — the client re-fetches before retrying.

Node positions are excluded from the undo history and from the auto-save debounce path; they are flushed to Postgres only on `onNodeDragStop`.

### Realtime updates

The browser subscribes to `useRealtimeRunsWithTag("run:<runId>")` using a scoped PAT minted at run creation. Task status changes map to node UI states:

| Trigger.dev status | Node state | Visual |
|--------------------|------------|--------|
| `EXECUTING` | `running` | Pulsating glow |
| `COMPLETED` | `success` | Output displayed |
| `FAILED` / `CRASHED` | `failed` | Red border + error |

---

## Adding a New Node Type

1. Add the data interface to `lib/nodes/types.ts` and extend the `CanvasNode` union
2. Add a Zod schema to `lib/nodes/schema.ts` and extend `canvasNodeSchema`
3. Add a default-data factory to `lib/nodes/defaults.ts`
4. Register it in `NODE_REGISTRY` (`lib/nodes/registry.ts`) with handle specs and metadata
5. Create the React component in `components/canvas/nodes/`
6. Add it to the `NODE_TYPES` map in `WorkflowCanvas.tsx`
7. Add it to the `PICKER_NODES` array in `NodePicker.tsx`
8. Create a Trigger.dev task in `trigger/node.<name>.ts` and add a case to the `runNode` switch in `workflow.execute.ts`

---

## License

MIT
