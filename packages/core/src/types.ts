export type Platform = 'windows' | 'macos' | 'linux'
export type Architecture = 'x64' | 'arm64'

export type ToolCategory = 'language' | 'package_manager' | 'ai_tool' | 'ide' | 'mcp' | 'cli'
export type PackageManagerName = 'brew' | 'winget' | 'choco' | 'apt' | 'dnf' | 'pacman' | 'npm' | 'pipx' | 'cargo' | 'go' | 'uv'

export type DetectionType = 'command' | 'file' | 'registry' | 'env'
export type InstallType = 'package_manager' | 'download' | 'script' | 'custom'
export type VerifierType = 'command' | 'version_command' | 'file'

export interface DetectionStrategy {
  type: DetectionType
  value: string
  args?: string[]
  parse?: (output: string) => boolean | string
}

export interface InstallStrategy {
  type: InstallType
  packageManager?: PackageManagerName
  packageName?: string
  url?: string
  commands?: string[]
  sudo?: boolean
  env?: Record<string, string>
}

export interface Verifier {
  type: VerifierType
  command?: string
  args?: string[]
  path?: string
  versionParser?: (output: string) => string | null
}

export interface Tool {
  id: string
  name: string
  description: string
  category: ToolCategory
  homepage?: string
  icon?: string
  tags: string[]
  detection: Partial<Record<Platform, DetectionStrategy[]>>
  install: Partial<Record<Platform, InstallStrategy[]>>
  verify: Verifier[]
  dependencies?: string[]
  conflicts?: string[]
  minVersion?: string
  recommended?: boolean
}

export interface MCPConfig {
  id: string
  name: string
  description: string
  command: string
  args: string[]
  env?: Record<string, string>
  disabled?: boolean
}

export interface Skill {
  id: string
  name: string
  description: string
  category: 'mcp' | 'prompt' | 'extension' | 'agent'
  mcpConfig?: MCPConfig
  homepage?: string
  tags: string[]
}

export interface Extension {
  id: string
  name: string
  publisher: string
  description: string
  ideTarget: 'vscode' | 'cursor' | 'windsurf' | 'jetbrains'
  marketplaceUrl?: string
}

export interface Template {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  dependencies: string[]
  commands: string[]
  postInstructions?: string[]
}

export interface Profile {
  id: string
  name: string
  description: string
  role: string
  tools: string[]
  mcps: string[]
  skills: string[]
  extensions?: Extension[]
  envVars?: Record<string, string>
  icon?: string
  featured?: boolean
}

export interface InstallResult {
  success: boolean
  error?: string
  log: string[]
  version?: string
}

export interface VerificationResult {
  installed: boolean
  version?: string
  path?: string
  error?: string
}

export interface InstalledTool {
  toolId: string
  version?: string
  path?: string
  verified: boolean
  installedAt: string
}

export interface InstallerPlugin {
  id: string
  name: string
  version: string
  supportedTools: string[]
  detect(tool: Tool, platform: Platform): Promise<DetectionStrategy | null>
  install(tool: Tool, platform: Platform, strategy: InstallStrategy): Promise<InstallResult>
  verify(tool: Tool, verifier: Verifier): Promise<VerificationResult>
}

export interface FastVibeConfig {
  version: string
  profile?: string
  selectedTools: string[]
  selectedMcps: string[]
  selectedSkills: string[]
  customTools: Tool[]
  installed: Record<string, InstalledTool>
  env: Record<string, string>
}

export interface ProgressEvent {
  type: 'start' | 'progress' | 'success' | 'warning' | 'error' | 'info' | 'done'
  toolId?: string
  message: string
  timestamp: number
}