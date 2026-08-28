import type { Tool, Platform, InstallResult, ProgressEvent } from '@fastvibe/core'
import { detectSystemInfo, type SystemInfo } from './platform.js'
import { runCommand, runScript, downloadFile } from './executor.js'
import { verifyTool } from './verification.js'

export type ProgressCallback = (event: ProgressEvent) => void

export class InstallEngine {
  private systemInfo: SystemInfo
  private installLogs: Map<string, string[]> = new Map()
  private onProgress?: ProgressCallback

  constructor(onProgress?: ProgressCallback) {
    this.systemInfo = detectSystemInfo()
    this.onProgress = onProgress
  }

  get platform(): Platform { return this.systemInfo.platform }

  private emit(event: Omit<ProgressEvent, 'timestamp'>): void {
    this.onProgress?.({ ...event, timestamp: Date.now() })
  }

  private log(toolId: string, message: string): void {
    const logs = this.installLogs.get(toolId) || []
    logs.push(message)
    this.installLogs.set(toolId, logs)
  }

  async detect(tool: Tool): Promise<boolean> {
    this.emit({ type: 'info', toolId: tool.id, message: `Checking ${tool.name}...` })
    const result = await verifyTool(tool)
    return result.installed
  }

  async install(tool: Tool): Promise<InstallResult> {
    const logs: string[] = []
    const log = (msg: string) => { logs.push(msg); this.log(tool.id, msg) }

    this.emit({ type: 'start', toolId: tool.id, message: `Installing ${tool.name}...` })
    log(`Starting installation of ${tool.name} (${tool.id})`)

    const strategies = tool.install[this.systemInfo.platform]
    if (!strategies || strategies.length === 0) {
      const msg = `No install strategy for ${tool.name} on ${this.systemInfo.platform}`
      log(msg)
      this.emit({ type: 'error', toolId: tool.id, message: msg })
      return { success: false, error: msg, log: logs }
    }

    for (const strategy of strategies) {
      log(`Trying strategy: ${strategy.type}`)

      try {
        switch (strategy.type) {
          case 'package_manager': {
            const pm = strategy.packageManager
            if (pm === 'npm' || pm === 'pipx' || pm === 'cargo' || pm === 'go' || pm === 'uv') {
              const installCmd = getGlobalInstallCommand(pm, strategy.packageName ?? tool.id)
              const result = await runScript(installCmd, this.systemInfo.platform)
              log(`Ran: ${installCmd} => exit ${result.exitCode}`)
              if (!result.success) throw new Error(result.stderr || 'Command failed')
            } else {
              const installCmd = getPackageManagerInstallCommand(pm, strategy.packageName ?? tool.id, strategy.sudo)
              log(`Running: ${installCmd}`)
              const result = await runCommand('bash', ['-c', installCmd])
              log(`Result: exit ${result.exitCode}`)
              if (!result.success) throw new Error(result.stderr || 'Package manager install failed')
            }
            break
          }
          case 'download': {
            if (strategy.url) {
              log(`Downloading from ${strategy.url}`)
              await downloadFile(strategy.url)
            }
            break
          }
          case 'script': {
            for (const cmd of strategy.commands ?? []) {
              log(`Running: ${cmd}`)
              const result = await runScript(cmd, this.systemInfo.platform)
              log(`Result: exit ${result.exitCode}`)
              if (!result.success) throw new Error(result.stderr || 'Script command failed')
            }
            break
          }
          case 'custom': {
            log('Custom strategy — delegating to plugin')
            break
          }
        }

        // Verify installation
        this.emit({ type: 'progress', toolId: tool.id, message: `Verifying ${tool.name}...` })
        const verification = await verifyTool(tool)
        if (verification.installed) {
          const msg = `${tool.name} installed successfully${verification.version ? ` (v${verification.version})` : ''}`
          log(msg)
          this.emit({ type: 'success', toolId: tool.id, message: msg })
          return { success: true, log: logs, version: verification.version }
        } else {
          throw new Error('Verification failed after installation')
        }
      } catch (error: any) {
        const msg = `Strategy ${strategy.type} failed: ${error.message}`
        log(msg)
        this.emit({ type: 'warning', toolId: tool.id, message: msg })
        // Continue to next strategy
      }
    }

    const msg = `All install strategies failed for ${tool.name}`
    log(msg)
    this.emit({ type: 'error', toolId: tool.id, message: msg })
    return { success: false, error: msg, log: logs }
  }
}

function getGlobalInstallCommand(pm: string, packageName: string): string {
  switch (pm) {
    case 'npm': return `npm install -g ${packageName}`
    case 'pipx': return `pipx install ${packageName}`
    case 'cargo': return `cargo install ${packageName}`
    case 'go': return `go install ${packageName}@latest`
    case 'uv': return `uv tool install ${packageName}`
    default: return `npm install -g ${packageName}`
  }
}

function getPackageManagerInstallCommand(pm: string | undefined, packageName: string, sudo?: boolean): string {
  const s = sudo ? 'sudo ' : ''
  switch (pm) {
    case 'brew': return `${s}brew install ${packageName}`
    case 'winget': return `winget install ${packageName}`
    case 'choco': return `choco install ${packageName} -y`
    case 'apt': return `${s}apt-get install -y ${packageName}`
    case 'dnf': return `${s}dnf install -y ${packageName}`
    case 'pacman': return `${s}pacman -S --noconfirm ${packageName}`
    default: return `${s}apt-get install -y ${packageName}`
  }
}