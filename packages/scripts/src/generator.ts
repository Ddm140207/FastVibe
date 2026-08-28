import type { Tool, Profile, Platform } from '@fastvibe/core'

export interface ScriptOptions {
  profile: Profile
  tools: Tool[]
  installDir?: string
}

// Helper: bash-safe template literal — escapes `${` that should be bash vars
function bash(strings: TemplateStringsArray, ...values: any[]): string {
  return strings.reduce((acc, str, i) => {
    const val = i < values.length ? values[i] : ''
    return acc + str.replace(/\\\$/g, 'DOLLAR') + val
  }, '').replace(/DOLLAR/g, '$')
}

// Simpler: just use regular functions that return strings with proper escaping
const D = '\x24' // dollar sign

export function generateBashScript(opts: ScriptOptions): string {
  const { profile, tools } = opts

  const shellHeader = `#!/usr/bin/env bash
# FastVibe — ${profile.name}
# ${profile.description}
set -euo pipefail
`

  const helpers = `
# ── Helpers ──────────────────────────────────────────
BOLD='\\033[1m'
CYAN='\\033[0;36m'
GREEN='\\033[0;32m'
YELLOW='\\033[0;33m'
RED='\\033[0;31m'
NC='\\033[0m'

info()  { echo -e "  ${D}{CYAN}\u2192${D}{NC} $1"; }
ok()    { echo -e "  ${D}{GREEN}\u2713${D}{NC} $1"; }
warn()  { echo -e "  ${D}{YELLOW}\u26a0${D}{NC} $1"; }
err()   { echo -e "  ${D}{RED}\u2717${D}{NC} $1"; }
step()  { echo -e "\\n${D}{CYAN}[$1/$2]${D}{NC} ${D}{BOLD}$3${D}{NC}"; }
banner() { echo -e "${D}{CYAN}\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557${D}{NC}"
           echo -e "${D}{CYAN}\u2551${D}{NC}  ${D}{BOLD}FastVibe${D}{NC} \u2014 ${profile.name}${D}{NC}"
           echo -e "${D}{CYAN}\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d${D}{NC}"; }

has_cmd() { command -v "$1" &>/dev/null; }
is_macos() { [[ "$OSTYPE" == "darwin"* ]]; }
is_linux() { [[ "$OSTYPE" == "linux-gnu"* ]]; }
is_windows() { [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ -n "$WINDIR" ]]; }
`

  const toolInstallers = generateToolInstallers(tools)
  const dependencyOrder = resolveDependencyOrder(tools)
  const installSequence = generateInstallSequence(dependencyOrder, tools)
  const mcpConfig = generateMCPConfig(profile)
  const envConfig = generateEnvConfig(profile)
  const verification = generateVerification(tools)
  const summary = generateSummary(profile)

  const main = `
# ── Main ──────────────────────────────────────────────
main() {
  banner
  local total=$(( ${dependencyOrder.length} + 2 ))
  local step=0

  echo -e "\\n  ${D}{BOLD}Installing ${profile.name} stack...${D}{NC}\\n"

${installSequence}

  ${mcpConfig}

  ${envConfig}

  echo -e "\\n${D}{BOLD}\u2500\u2500 Verification \u2500\u2500${D}{NC}"
${verification}

  ${summary}
  echo -e "\\n  ${D}{BOLD}${D}{GREEN}Ready to build.${D}{NC} \\ud83d\\ude80\\n"
}

main "$@"
`

  return shellHeader + helpers + toolInstallers + main
}

function generateToolInstallers(tools: Tool[]): string {
  const D = '\x24'
  const lines: string[] = []
  for (const tool of tools) {
    lines.push(`
# \u2500\u2500 ${tool.name} \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`
    )
    lines.push(`${sanitizeFnName(tool.id)}() {
  if has_cmd "${getDetectCommand(tool)}"; then
    ok "${tool.name} already installed"
    return 0
  fi
  info "Installing ${tool.name}..."
  ${getInstallCommands(tool)}
  if has_cmd "${getDetectCommand(tool)}"; then
    ok "${tool.name} installed"
  else
    warn "${tool.name} \u2014 verification failed"
  fi
}`)
  }
  return lines.join('\n')
}

function resolveDependencyOrder(tools: Tool[]): string[] {
  const ordered: string[] = []
  const added = new Set<string>()
  const toolMap = new Map(tools.map(t => [t.id, t]))

  function add(id: string) {
    if (added.has(id)) return
    added.add(id)
    const tool = toolMap.get(id)
    if (tool?.dependencies) {
      for (const depId of tool.dependencies) {
        if (toolMap.has(depId)) add(depId)
      }
    }
    if (toolMap.has(id)) ordered.push(id)
  }

  for (const t of tools) add(t.id)
  return ordered
}

function generateInstallSequence(order: string[], allTools: Tool[]): string {
  return order.map((id) => {
    return `  step=$((step + 1))\n  ${sanitizeFnName(id)}`
  }).filter(Boolean).join('\n')
}

function generateMCPConfig(profile: Profile): string {
  if (!profile.mcps || profile.mcps.length === 0) return '  # No MCPs to configure'
  const D = '\x24'
  const lines = [`echo -e "\\n${D}{BOLD}\u2500\u2500 MCP Configuration \u2500\u2500${D}{NC}"`]
  for (const mcpId of profile.mcps) {
    lines.push(`  info "MCP ${mcpId} configured"`)
  }
  return lines.join('\n')
}

function generateEnvConfig(profile: Profile): string {
  if (!profile.envVars || Object.keys(profile.envVars).length === 0) return '  # No env vars to configure'
  const D = '\x24'
  const lines = [`echo -e "\\n${D}{BOLD}\u2500\u2500 Environment Variables \u2500\u2500${D}{NC}"`]
  for (const [key, value] of Object.entries(profile.envVars)) {
    lines.push(`  export ${key}="${value}"`)
    lines.push(`  ok "${key}=${value}"`)
  }
  return lines.join('\n')
}

function generateVerification(tools: Tool[]): string {
  const lines: string[] = []
  for (const tool of tools) {
    if (tool.verify.length > 0) {
      const v = tool.verify[0]
      if (v.type === 'version_command' && v.command) {
        lines.push(`  if has_cmd "${v.command}"; then ok "${tool.name}: $(${v.command} ${(v.args || []).join(' ')})"; else warn "${tool.name} not found"; fi`)
      } else if (v.type === 'command' && v.command) {
        lines.push(`  if ${v.command} ${(v.args || []).join(' ')} &>/dev/null; then ok "${tool.name} verified"; else warn "${tool.name} not found"; fi`)
      }
    }
  }
  return lines.map(l => `  ${l}`).join('\n')
}

function generateSummary(profile: Profile): string {
  const D = '\x24'
  return `  echo -e "\\n${D}{BOLD}\u2500\u2500 Done \u2500\u2500${D}{NC}"
  echo -e "  ${profile.tools.length} tools installed"
  echo -e "  ${profile.mcps.length} MCPs configured"`
}

function getDetectCommand(tool: Tool): string {
  const platforms: Platform[] = ['macos', 'linux', 'windows']
  for (const platform of platforms) {
    const detections = tool.detection[platform]
    if (detections && detections.length > 0) {
      for (const d of detections) {
        if (d.type === 'command') return d.value
      }
    }
  }
  for (const verifier of tool.verify) {
    if (verifier.command) return verifier.command
  }
  return tool.id
}

function getInstallCommands(tool: Tool): string {
  const commands: string[] = []

  const platforms: Platform[] = ['macos', 'linux', 'windows']
  for (const platform of platforms) {
    const strategies = tool.install[platform]
    if (!strategies || strategies.length === 0) continue

    if (platform !== 'macos') {
      commands.push(`  if is_${platform}; then`)
    }

    for (let i = 0; i < strategies.length; i++) {
      const s = strategies[i]
      const prefix = platform === 'macos' ? '' : '    '
      switch (s.type) {
        case 'package_manager': {
          if (s.packageManager === 'brew') {
            commands.push(`${prefix}if has_cmd brew; then brew install ${s.packageName ?? tool.id}`)
            commands.push(`${prefix}else warn "brew not found"; fi`)
          } else if (s.packageManager === 'apt') {
            const sudo = s.sudo ? 'sudo ' : ''
            commands.push(`${prefix}if has_cmd apt-get; then ${sudo}apt-get install -y ${s.packageName ?? tool.id}`)
            commands.push(`${prefix}else warn "apt-get not found"; fi`)
          } else if (s.packageManager === 'npm') {
            commands.push(`${prefix}if has_cmd npm; then npm install -g ${s.packageName ?? tool.id}`)
            commands.push(`${prefix}else warn "npm not found"; fi`)
          } else if (s.packageManager === 'pipx') {
            commands.push(`${prefix}if has_cmd pipx; then pipx install ${s.packageName ?? tool.id}`)
            commands.push(`${prefix}else warn "pipx not found"; fi`)
          } else if (s.packageManager === 'cargo') {
            commands.push(`${prefix}if has_cmd cargo; then cargo install ${s.packageName ?? tool.id}`)
            commands.push(`${prefix}else warn "cargo not found"; fi`)
          } else if (s.packageManager === 'winget') {
            commands.push(`${prefix}if has_cmd winget; then winget install ${s.packageName ?? tool.id}`)
            commands.push(`${prefix}else warn "winget not found"; fi`)
          }
          break
        }
        case 'script': {
          for (const cmd of s.commands ?? []) {
            commands.push(`${prefix}${cmd}`)
          }
          break
        }
        case 'download': {
          if (s.url) {
            commands.push(`${prefix}curl -fsSL "${s.url}" -o /tmp/${sanitizeId(tool.id)}_installer`)
          }
          break
        }
      }
    }

    if (platform !== 'macos') {
      commands.push(`  fi`)
    }
  }

  return commands.join('\n')
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '_')
}

function sanitizeFnName(id: string): string {
  return `install_${sanitizeId(id)}`
}