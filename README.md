<div align="center">

# ⚡ FastVibe

### From zero to AI-ready in one click.

The fastest way to start **vibe coding**. A single `curl` command installs your entire dev environment — languages, AI tools, MCP servers, IDEs, and project templates.

</div>

---

## 🚀 Get Started

Install the everything-included **Vibecoder** stack with one command:

```bash
curl https://fastvibe.dev/install | bash
```

Or choose a specific stack:

```bash
curl https://fastvibe.dev/install/ai-engineer | bash
curl https://fastvibe.dev/install/frontend | bash
curl https://fastvibe.dev/install/data-science | bash
curl https://fastvibe.dev/install/ai-agent-builder | bash
curl https://fastvibe.dev/install/backend | bash
curl https://fastvibe.dev/install/devops | bash
curl https://fastvibe.dev/install/fullstack | bash
curl https://fastvibe.dev/install/minimal | bash
```

Or build your own custom combo:

```bash
curl "https://fastvibe.dev/install/custom?tools=python,node,ollama" | bash
```

> 🔥 **Tip:** Once installed, ask your favorite AI agent (Claude, ChatGPT, Gemini, Codex…) to run FastVibe for you — it's built for AI-first workflows.

---

## 📦 Available Stacks

| Stack | ID | What you get |
|-------|----|--------------|
| 🚀 **Vibecoder** (default) | `vibecoder` | Everything: Python, Node, Go, Rust, Java, Bun, Claude Code, Ollama, Docker, VS Code, Cursor, MCPs + more |
| 🤖 **AI Engineer** | `ai-engineer` | Python, Node, Ollama, Claude Code, Cursor, Docker, Gemini CLI, Git, MCPs |
| 🎨 **Frontend** | `frontend` | Node, pnpm, Bun, VS Code, Cursor, Git |
| 📊 **Data Science** | `data-science` | Python, uv, Jupyter, Polars, DuckDB, Ollama, Docker |
| 🦾 **AI Agent Builder** | `ai-agent-builder` | LangGraph, FastAPI, Playwright, Docker, MCP tooling |
| ⚙️ **Backend** | `backend` | Node.js, Python, Go, Rust, Docker, PostgreSQL |
| 🛠️ **DevOps** | `devops` | Docker, Git, GitHub CLI, Python, Node, Go |
| 🌐 **Full Stack** | `fullstack` | Frontend + backend + databases, Claude Code |
| ⚡ **Minimal** | `minimal` | Just the essentials: Python, Node, Git, VS Code |

---

## ✨ Features

- **One-click setup** — No more 2–8 hours of manual dependency hell.
- **Pre-configured AI ecosystem** — Claude Code, Gemini CLI, Ollama, Cursor, and more, wired up and ready.
- **MCP servers included** — Filesystem, GitHub, Memory, Postgres, Browser connectors pre-configured.
- **Isolated environments** — Uses `uv` and `pipx` to avoid conflicting Python/Node versions.
- **Custom picker** — Choose exactly the tools you need via the [web picker](https://fastvibe.dev/#picker).
- **Cross-platform** — Works on macOS, Linux, and Windows (WSL/Git Bash).
- **Verification built-in** — Every tool is verified after installation, with clear progress output.
- **Instant project templates** — SaaS, AI Agent, MCP Server, Next.js, FastAPI, CLI, RAG, LangGraph, CrewAI, and more.

---

## 🧱 Project Templates

After installing your stack, FastVibe can generate a ready-to-run base project:

- SaaS Starter — Next.js + auth + payments
- AI Agent — LangGraph + FastAPI
- MCP Server — TypeScript
- Next.js App / React + Vite
- FastAPI / Express API
- CLI Tool
- Discord Bot
- RAG Pipeline
- LangGraph Multi-Agent
- CrewAI Orchestration

---

## 🗺️ The FastVibe Flow

```
1️⃣ curl        2️⃣ pick stack      3️⃣ pick template      4️⃣ start building
```

Four steps. From zero to code in minutes.

---

## 🏗️ Monorepo Architecture

FastVibe is a pnpm + Turborepo monorepo:

```
fastvibe/
├── packages/
│   ├── core/        # Tool & profile registry (types, tools, profiles, skills, templates)
│   ├── server/      # HTTP server: serves install scripts, API, and the website
│   ├── scripts/     # Generates the curl-to-bash install scripts
│   ├── installer/   # Local install engine with platform detection & verification
│   ├── website/     # Landing page / web picker (static HTML + Tailwind)
│   └── scripts/     # Project template generator
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### Packages

| Package | Purpose |
|---------|---------|
| `@fastvibe/core` | Central registry of tools, profiles (stacks), skills, templates, and types |
| `@fastvibe/server` | Node HTTP server — `GET /install/{profile}` returns a ready-to-run bash script, `GET /api/profiles` is a JSON API, `/` serves the website |
| `@fastvibe/scripts` | Bash script generator with dependency resolution, per-platform installers, MCP/env config, and verification |
| `@fastvibe/installer` | Programmatic install engine — platform/architecture detection, command executor, tool verification |

---

## 🔧 Local Development

**Requirements:** Node.js ≥ 20, pnpm 10+

```bash
# Install dependencies (from repo root)
pnpm install

# Build all packages
pnpm build

# Start the server (http://localhost:3000)
pnpm dev
```

Then test locally:

```bash
curl http://localhost:3000/install | bash                          # Vibecoder
curl http://localhost:3000/install/ai-engineer | bash              # Specific stack
curl "http://localhost:3000/install/custom?tools=python,node" | bash  # Custom combo
curl http://localhost:3000/api/profiles                            # JSON API
```

---

## 🤖 Built for AI agents first

FastVibe is designed to be triggered from your agent of choice. Right from the website you can open ChatGPT, Claude, Gemini — or copy the command straight into Hermes, OpenCode, or Codex — and let the agent handle the setup for you.

---

## 🧩 Adding a Tool or Stack

Tools live in `packages/core/src/tools.ts`. Each tool defines:

- **detection** — commands to check if the tool is already installed (per platform)
- **install** — strategies per platform (`brew`, `apt`, `npm`, `pipx`, `cargo`, `winget`, `script`, `download`)
- **verify** — how to confirm the install succeeded
- **dependencies** — other tools required first

```ts
export const myTool: Tool = {
  id: 'my-tool',
  name: 'My Tool',
  category: 'ai',
  recommended: false,
  detection: { macos: [{ type: 'command', value: 'mytool' }], linux: [...], windows: [...] },
  install: { macos: [{ type: 'brew', packageName: 'mytool' }], ... },
  verify: [{ type: 'version_command', command: 'mytool', args: ['--version'] }],
  dependencies: ['node'],
}
```

Add the tool's `id` to any profile's `tools` array in `packages/core/src/profiles.ts` to include it in that stack.

---

## 📄 License

MIT
