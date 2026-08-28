import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import { Registry } from '@fastvibe/core'
import { generateBashScript } from '@fastvibe/scripts'

const registry = new Registry()
const PORT = parseInt(process.env.PORT || '3000', 10)
const WWW_DIR = resolve(import.meta.dirname, '../../website')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
}

function serveFile(res: ServerResponse, filePath: string): void {
  const ext = extname(filePath)
  try {
    const content = readFileSync(filePath)
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    res.end(content)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  }
}

function serveInstallScript(res: ServerResponse, profileId?: string): void {
  const profile = profileId ? registry.getProfile(profileId) : registry.getProfile('vibecoder')

  if (!profile) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end(`Profile '${profileId}' not found. Available: ${registry.profiles.map(p => p.id).join(', ')}`)
    return
  }

  const tools = registry.getProfileTools(profile.id)
  const script = generateBashScript({ profile, tools })

  res.writeHead(200, {
    'Content-Type': 'text/x-shellscript; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    'X-Profile-Id': profile.id,
    'X-Profile-Name': profile.name,
  })
  res.end(script)
}

function serveCustomInstallScript(res: ServerResponse, toolIds: string[]): void {
  const tools = registry.getToolsByIds(toolIds)
  if (tools.length === 0) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('No valid tools specified. Use ?tools=python,node,ollama')
    return
  }

  const profile = {
    id: 'custom',
    name: 'Custom Setup',
    description: 'Custom tool selection',
    role: 'Custom',
    tools: toolIds,
    mcps: [],
    skills: [],
  }

  const script = generateBashScript({ profile, tools })

  res.writeHead(200, {
    'Content-Type': 'text/x-shellscript; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    'X-Profile-Id': 'custom',
    'X-Tools': toolIds.join(','),
  })
  res.end(script)
}

function serveApiProfiles(res: ServerResponse): void {
  const data = registry.profiles.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    icon: p.icon,
    featured: p.featured,
    toolCount: p.tools.length,
    mcpCount: p.mcps.length,
    skillCount: p.skills.length,
    installUrl: `https://fastvibe.dev/install/${p.id}`,
  }))
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data, null, 2))
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const path = url.pathname

  // Install scripts
  if (path === '/install/custom') {
    const toolsParam = url.searchParams.get('tools')
    const toolIds = toolsParam ? toolsParam.split(',').map(s => s.trim()).filter(Boolean) : []
    return serveCustomInstallScript(res, toolIds)
  }

  if (path === '/install' || path.startsWith('/install/')) {
    const profileId = path === '/install' ? undefined : path.slice('/install/'.length)
    return serveInstallScript(res, profileId)
  }

  // API
  if (path === '/api/profiles') return serveApiProfiles(res)

  // Static files (website)
  if (path === '/' || path === '') {
    return serveFile(res, resolve(WWW_DIR, 'index.html'))
  }

  const filePath = resolve(WWW_DIR, path.slice(1))
  if (filePath.startsWith(WWW_DIR) && existsSync(filePath)) {
    return serveFile(res, filePath)
  }

  // Fallback to index.html (SPA-friendly)
  serveFile(res, resolve(WWW_DIR, 'index.html'))
})

server.listen(PORT, () => {
  console.log(`FastVibe server running on http://localhost:${PORT}`)
  console.log(`  Install script:  curl http://localhost:${PORT}/install | bash (Vibecoder — todo incluido)`)
  console.log(`  By profile:      curl http://localhost:${PORT}/install/vibecoder | bash`)
  console.log(`  Website:         http://localhost:${PORT}/`)
  console.log(`  Custom:          curl http://localhost:${PORT}/install/custom?tools=python,node,ollama | bash`)
})