<div align="center">

# ⚡ FastVibe

[![Live site](https://img.shields.io/badge/live-fastvibe.onrender.com-8b5cf6?style=flat-square)](https://fastvibe.onrender.com)

### From zero to AI-ready in one click.

The fastest way to start **vibe coding**. A single `curl` command installs your entire dev environment — languages, AI tools, MCP servers, IDEs, and project templates.

**🌐 Live:** https://fastvibe.onrender.com

</div>

---

## 🚀 Get Started

Install the everything-included **Vibecoder** stack with one command:

```bash
curl https://fastvibe.onrender.com/install | bash
```

Or choose a specific stack:

```bash
curl https://fastvibe.onrender.com/install/ai-engineer | bash
curl https://fastvibe.onrender.com/install/frontend | bash
curl https://fastvibe.onrender.com/install/data-science | bash
curl https://fastvibe.onrender.com/install/ai-agent-builder | bash
curl https://fastvibe.onrender.com/install/backend | bash
curl https://fastvibe.onrender.com/install/devops | bash
curl https://fastvibe.onrender.com/install/fullstack | bash
curl https://fastvibe.onrender.com/install/minimal | bash
```

Or build your own custom combo:

```bash
curl "https://fastvibe.onrender.com/install/custom?tools=python,node,ollama" | bash
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
- **Custom picker** — Choose exactly the tools you need via the [web picker](https://fastvibe.onrender.com/#picker).
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

## ☁️ Deploy on Render

The production site runs at **https://fastvibe.onrender.com** as a Render Web Service:

| Setting | Value |
|---------|-------|
| Build command | `pnpm install && pnpm build` |
| Start command | `pnpm start` |
| Environment | `PUBLIC_URL=https://fastvibe.onrender.com` (optional, this is the default) |

`PORT` is provided by Render automatically. The server serves the landing page, the install scripts, and the assets (favicons, OG image, manifest, robots, sitemap) from `packages/website`.

---

## 🔄 Monthly tool version refresh

Las versiones fijas de las herramientas (las que no instalan "latest" vía package manager) viven en un solo lugar: `packages/core/src/versions.ts`.

El workflow `.github/workflows/update-tool-versions.yml` corre **el día 1 de cada mes a las 06:00 UTC** y:

1. Consulta las fuentes oficiales de cada herramienta:
   - Python → `endoflife.date/api/python` (espejo de python.org)
   - Node.js → `nodejs.org/dist/index.json`
   - Go → `go.dev/dl/?mode=json`
   - .NET SDK → `dotnetcli` release metadata
   - Git for Windows → GitHub Releases (`git-for-windows/git`)
2. Verifica que la URL de descarga exista **antes** de fijarla (si da 404, mantiene la versión anterior).
3. Actualiza `versions.ts`, corre `pnpm build` y abre/actualiza un PR en la rama `chore/tool-versions`.
4. Intenta auto-merge (squash). Si el repo no lo permite, el PR queda para revisión.

### Política de compatibilidad (sin conflictos)

- Por defecto **solo sube patch/minor dentro de la misma línea**: Python `3.12.x`, Node `22.x`, Go `1.22.x`, .NET `8.0.x`, Git `2.x`.
- Nunca aplica un salto de versión mayor automáticamente.
- Ignora prereleases (alpha/beta/rc/dev).
- Para Python baja al último patch que realmente tenga instalador `.exe` (los releases *security-only* no lo tienen).

### Comandos manuales

```bash
pnpm versions:check    # muestra qué hay nuevo (exit 1 si hay updates)
pnpm versions:update   # aplica las actualizaciones seguras
pnpm versions:verify   # chequea además que las URLs sigan vivas
```

Para permitir saltos mayores (revisar el PR antes de mergear):

```bash
node scripts/update-versions.mjs --major
```

O desde GitHub → Actions → *Monthly tool version refresh* → **Run workflow** con `major = true`.

> `java` y `lmstudio` quedan como revisión manual porque no exponen una API pública estable.

---

## 📄 License

MIT
