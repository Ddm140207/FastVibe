import type { Platform, Architecture } from '@fastvibe/core'

export interface SystemInfo {
  platform: Platform
  architecture: Architecture
  homeDir: string
  shell: string
  packageManagers: string[]
}

export function detectPlatform(): Platform {
  const p = process.platform
  if (p === 'win32') return 'windows'
  if (p === 'darwin') return 'macos'
  return 'linux'
}

export function detectArchitecture(): Architecture {
  const a = process.arch
  return a === 'arm64' ? 'arm64' : 'x64'
}

export function detectShell(): string {
  return process.env.SHELL || process.env.ComSpec || 'bash'
}

export function detectSystemInfo(): SystemInfo {
  return {
    platform: detectPlatform(),
    architecture: detectArchitecture(),
    homeDir: process.env.HOME || process.env.USERPROFILE || '/home/user',
    shell: detectShell(),
    packageManagers: detectAvailablePackageManagers(),
  }
}

export function detectAvailablePackageManagers(): string[] {
  const available: string[] = []
  const envPath = process.env.PATH || ''

  const checks = ['npm', 'pnpm', 'yarn', 'brew', 'winget', 'choco', 'apt', 'pip', 'pipx', 'cargo', 'go', 'uv']
  for (const pm of checks) {
    const paths = envPath.split(';').concat(envPath.split(':'))
    const found = paths.some(p => {
      try {
        const fs = require('fs')
        const candidates = [
          `${p}/bin/${pm}`, `${p}/${pm}`,
          `${p}/${pm}.exe`, `${p}/${pm}.cmd`,
        ]
        return candidates.some((c: string) => fs.existsSync(c))
      } catch { return false }
    })
    if (found) available.push(pm)
  }
  return available
}