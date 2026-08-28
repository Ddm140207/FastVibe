import { execa } from 'execa'
import type { Platform } from '@fastvibe/core'

export interface CommandResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
}

export async function runCommand(
  command: string,
  args: string[] = [],
  options?: { sudo?: boolean; cwd?: string; env?: Record<string, string>; timeout?: number }
): Promise<CommandResult> {
  const finalCmd = options?.sudo && !isWindows() ? 'sudo' : command
  const finalCmdArgs = options?.sudo && !isWindows() ? [command, ...args] : args

  try {
    const result = await execa(finalCmd, finalCmdArgs, {
      cwd: options?.cwd,
      env: options?.env,
      timeout: options?.timeout ?? 120_000,
      reject: false,
      windowsHide: true,
    })
    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? null,
    }
  } catch (error: any) {
    return {
      success: false,
      stdout: '',
      stderr: error?.message ?? String(error),
      exitCode: -1,
    }
  }
}

export async function runScript(
  script: string,
  platform: Platform,
  options?: { cwd?: string; env?: Record<string, string> }
): Promise<CommandResult> {
  if (platform === 'windows') {
    return runCommand('powershell', ['-NoProfile', '-Command', script], options)
  }
  return runCommand('bash', ['-c', script], options)
}

export async function downloadFile(url: string, destination?: string): Promise<string> {
  const platform = process.platform === 'win32' ? 'windows' : 'linux'
  if (platform === 'windows') {
    const result = await runCommand('powershell', [
      '-NoProfile', '-Command',
      `Invoke-WebRequest -Uri "${url}" -OutFile "${destination || 'downloaded_file'}"`,
    ])
    return result.stdout
  }
  const result = await runCommand('curl', ['-fsSL', url, '-o', destination || 'downloaded_file'])
  return result.stdout
}

function isWindows(): boolean {
  return process.platform === 'win32'
}