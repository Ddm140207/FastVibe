import type { Tool, VerificationResult, Verifier } from '@fastvibe/core'
import { runCommand } from './executor.js'

export async function verifyTool(tool: Tool): Promise<VerificationResult> {
  for (const verifier of tool.verify) {
    const result = await runVerifier(verifier)
    if (result.installed) return result
  }
  return { installed: false, error: `No verifier succeeded for ${tool.name}` }
}

async function runVerifier(verifier: Verifier): Promise<VerificationResult> {
  switch (verifier.type) {
    case 'version_command': {
      if (!verifier.command) return { installed: false }
      const result = await runCommand(verifier.command, verifier.args ?? [])
      if (result.success) {
        const version = verifier.versionParser
          ? verifier.versionParser(result.stdout)
          : parseVersion(result.stdout)
        return { installed: true, version: version ?? undefined, path: result.stdout.split('\n')[0] }
      }
      return { installed: false }
    }
    case 'command': {
      if (!verifier.command) return { installed: false }
      const result = await runCommand(verifier.command, verifier.args ?? [])
      return { installed: result.success }
    }
    case 'file': {
      if (!verifier.path) return { installed: false }
      try {
        const fs = await import('fs')
        const exists = fs.existsSync(verifier.path)
        return { installed: exists, path: exists ? verifier.path : undefined }
      } catch {
        return { installed: false }
      }
    }
    default:
      return { installed: false }
  }
}

function parseVersion(output: string): string | null {
  const match = output.match(/(\d+\.\d+\.\d+)/)
  return match ? match[1] : null
}