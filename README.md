
```markdown ⚡ NextFlow — AI Workflow Builder

> An advanced, interactive visual canvas application to orchestrate, execute, and inspect complex AI LLM workflows and multimodal pipelines in real-time.

Built and maintained by **Chirag Raj Dadhich** ([@chiragrajdadhich05iitp](https://github.com/chiragrajdadhich05iitp)).

---

## 📌 Overview

**NextFlow** is a modern visual programming interface for designing AI agent pipelines. It replaces complex pipeline code with an intuitive node-based graph editor. Users can define inputs, chain reasoning models, process structured documents, and observe step-by-step executions directly from a browser.

Originally scaffolded with cloud dependencies, the architecture has been streamlined with a zero-setup local SQLite database engine and credentials-based NextAuth session management, making it fully portable for both local development and enterprise deployment.

---

## ✨ Features

- **Interactive Node Canvas**: Drag-and-drop canvas built on top of React Flow with custom dynamic nodes (Inputs, AI Models, Output Handlers).
- **Zero-Config Local Database**: Backed by Prisma ORM and SQLite (`file:./dev.db`), eliminating the need for standalone database services.
- **Robust Authentication**: Complete session lifecycle handling powered by NextAuth.js (credentials provider, custom sign-up, session protection via layout guards).
- **Execution Tracking**: Monitor node states, inputs, outputs, errors, and execution latencies in real time.
- **Type-Safe Fullstack Architecture**: End-to-end type safety using TypeScript, Zod schema validation, and Next.js 14 App Router.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 14](https://nextjs.org/) (App Router) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) |
| **Canvas / Graph** | [React Flow](https://reactflow.dev/) |
| **Database & ORM** | [Prisma](https://www.prisma.io/) with SQLite |
| **Authentication** | [NextAuth.js](https://next-auth.js.org/) |
| **Validation** | [Zod](https://zod.dev/) |

---

## 🚀 Getting Started

Follow these instructions to run the application locally on your machine.

### Prerequisites

- Node.js 18.x or higher
- npm, yarn, or pnpm

### 1. Clone the Repository

```bash
git clone [https://github.com/chiragrajdadhich05iitp/ai-workflow-builder.git](https://github.com/chiragrajdadhich05iitp/ai-workflow-builder.git)
cd ai-workflow-builder

```

### 2. Install Dependencies

```bash
npm install

```

### 3. Environment Setup

Create a `.env` file in the root directory:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-generated-jwt-secret-key"
NEXTAUTH_URL="http://localhost:3000"

```

### 4. Database Setup

Synchronize your SQLite database and generate the Prisma Client:

```bash
npx prisma db push
npx prisma generate

```

### 5. Run the Application

```bash
npm run dev

```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📂 Project Architecture

```plaintext
├── app/
│   ├── (app)/                  # Protected application pages
│   │   ├── dashboard/          # Workflow listings & metrics
│   │   ├── workflow/[id]/      # Interactive canvas editor
│   │   └── layout.tsx          # Session validation & layout wrapper
│   ├── (auth)/                 # Public auth pages (Sign-in, Sign-up)
│   └── api/                    # Route handlers (Auth, Workflows, Execution)
├── components/
│   ├── canvas/                 # React Flow node configurations & editor
│   └── dashboard/              # Dashboard cards, lists, navigation
├── lib/
│   ├── auth.ts                 # NextAuth credentials setup
│   ├── prisma.ts               # Prisma singleton client
│   └── store/                  # Client-side canvas state management
└── prisma/
    └── schema.prisma           # Database models (User, Workflow, NodeRun)

```

---

## 👨‍💻 Author

**Chirag Raj Dadhich**

* GitHub: [@chiragrajdadhich05iitp](https://www.google.com/url?sa=E&source=gmail&q=https://github.com/chiragrajdadhich05iitp)

---

## 📄 License

This project is licensed under the MIT License - feel free to use and adapt it for your own projects.

```

```
