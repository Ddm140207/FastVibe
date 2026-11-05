#!/usr/bin/env node
/**
 * FastVibe — monthly tool version refresh.
 *
 * Reads the pinned versions from packages/core/src/versions.ts, asks the official
 * upstream sources for their latest stable release and updates the pins.
 *
 * Safety rules (so an automatic run never breaks compatibility):
 *  - By default it only moves within the SAME line: Python 3.12.x, Node 22.x,
 *    Go 1.22.x, .NET 8.0.x, Git 2.x. A major jump never happens automatically.
 *  - Prereleases (alpha/beta/rc/dev) are ignored.
 *  - A candidate URL is verified before it is written. If it 404s, the old pin stays.
 *  - Use `--major` to opt into major upgrades (review the PR before merging).
 *
 * Usage:
 *   node scripts/update-versions.mjs                 # apply updates
 *   node scripts/update-versions.mjs --check         # exit 1 if updates are available
 *   node scripts/update-versions.mjs --major         # allow major upgrades (opt-in)
 *   node scripts/update-versions.mjs --verify-urls   # also HEAD every pinned URL
 *   node scripts/update-versions.mjs --report=versions-report.md
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VERSIONS_FILE = path.join(ROOT, 'packages/core/src/versions.ts')

const argv = process.argv.slice(2)
const CHECK_ONLY = argv.includes('--check')
const ALLOW_MAJOR = argv.includes('--major')
const VERIFY_URLS = argv.includes('--verify-urls') || !CHECK_ONLY
const reportArg = argv.find((a) => a.startsWith('--report='))
const REPORT_FILE = reportArg ? path.resolve(ROOT, reportArg.slice('--report='.length)) : null

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''

const REPORT_HEADER =
  '// AUTO-GENERATED FILE — do not edit manually.\n' +
  '// Run `pnpm versions:update` to refresh the pinned tool versions.\n' +
  '// The monthly GitHub Action (.github/workflows/update-tool-versions.yml) does this automatically.\n'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function httpText(url, { accept = 'application/json', attempts = 3 } = {}) {
  let lastError
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          accept,
          'user-agent': 'fastvibe-version-updater',
          ...(GITHUB_TOKEN && url.includes('api.github.com')
            ? { authorization: `Bearer ${GITHUB_TOKEN}` }
            : {}),
        },
        signal: AbortSignal.timeout(25_000),
        redirect: 'follow',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      return await res.text()
    } catch (err) {
      lastError = err
      if (i < attempts) await sleep(1000 * i)
    }
  }
  throw lastError
}

async function getJson(url, opts) {
  return JSON.parse(await httpText(url, opts))
}

function parseVersions(source) {
  const start = source.indexOf('{')
  const end = source.indexOf('} as const')
  if (start < 0 || end < 0) throw new Error('No se pudo parsear versions.ts')
  return JSON.parse(source.slice(start, end + 1))
}

function renderVersions(versions) {
  const body = Object.entries(versions)
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`)
    .join(',\n')
  return `${REPORT_HEADER}export const VERSIONS = {\n${body}\n} as const\n`
}

function parts(version) {
  return String(version)
    .split(/[.\-+]/)
    .map((p) => (/^\d+$/.test(p) ? Number(p) : p))
}

function compareVersions(a, b) {
  const pa = parts(a)
  const pb = parts(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x === y) continue
    if (typeof x === 'number' && typeof y === 'number') return x < y ? -1 : 1
    return String(x) < String(y) ? -1 : 1
  }
  return 0
}

const isPrerelease = (v) => /(alpha|beta|rc|preview|pre|dev|nightly|snapshot)/i.test(v)
const isStableSemver = (v) => /^\d+\.\d+\.\d+$/.test(v) && !isPrerelease(v)
const majorOf = (v) => String(v).split('.')[0]
const minorOf = (v) => String(v).split('.').slice(0, 2).join('.')
const sameMajor = (a, b) => majorOf(a) === majorOf(b)
const sameMinor = (a, b) => minorOf(a) === minorOf(b)

function pickNewest(list) {
  return list.filter(Boolean).sort((a, b) => compareVersions(b, a))[0] ?? null
}

// ---------------------------------------------------------------------------
// Upstream sources (official)
// ---------------------------------------------------------------------------

async function latestPython(current) {
  // endoflife.date mirrors python.org's release list in JSON.
  const cycles = await getJson('https://endoflife.date/api/python.json')
  const usable = cycles.filter(
    (c) => isStableSemver(c.latest) && (c.eol === false || !c.eol || new Date(c.eol) > new Date()),
  )

  const candidates = ALLOW_MAJOR
    ? usable.map((c) => c.latest)
    : usable.filter((c) => minorOf(c.latest) === minorOf(current)).map((c) => c.latest)

  candidates.sort((a, b) => compareVersions(b, a))

  // Python ships "security-only" patches without Windows installers, so walk down
  // the patch series until we find one that actually has the .exe we pin.
  for (const candidate of candidates) {
    const [major, minor, patch] = candidate.split('.').map(Number)
    for (let p = patch; p >= 0; p--) {
      const version = `${major}.${minor}.${p}`
      if (compareVersions(version, current) < 0) break
      if (await hasPythonWindowsInstaller(version)) return version
    }
  }
  return null
}

async function hasPythonWindowsInstaller(version) {
  const res = await checkUrl(
    `https://www.python.org/ftp/python/${version}/python-${version}-amd64.exe`,
  )
  return res.ok
}

async function latestNode(current) {
  const releases = await getJson('https://nodejs.org/dist/index.json')
  const stable = releases.filter((r) => !isPrerelease(r.version) && r.files?.length)
  if (ALLOW_MAJOR) {
    const lts = stable.filter((r) => r.lts)
    return String((lts[0] ?? stable[0]).version).replace(/^v/, '')
  }
  const match = stable.find((r) => r.version.startsWith(`v${majorOf(current)}.`))
  return match ? String(match.version).replace(/^v/, '') : null
}

async function latestGo(current) {
  const releases = await getJson('https://go.dev/dl/?mode=json&include=all')
  const stable = releases.filter((r) => r.stable).map((r) => String(r.version).replace(/^go/, ''))
  if (ALLOW_MAJOR) return pickNewest(stable)
  return pickNewest(stable.filter((v) => sameMinor(v, current)))
}

async function latestDotnet(current) {
  if (!ALLOW_MAJOR) {
    const channel = await getJson(
      `https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/${minorOf(current)}/releases.json`,
    )
    const sdk = channel['latest-sdk']
    return isStableSemver(sdk) && sameMinor(sdk, current) ? sdk : null
  }
  const index = await getJson(
    'https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/releases-index.json',
  )
  const channels = (index['releases-index'] ?? [])
    .filter((c) => c['support-phase'] !== 'eol' && isStableSemver(c['latest-sdk']))
    .sort((a, b) => compareVersions(b['channel-version'], a['channel-version']))
  const lts = channels.find((c) => c['release-type'] === 'lts')
  return (lts ?? channels[0])?.['latest-sdk'] ?? null
}

async function latestGitWindows(current) {
  const wantedMajor = majorOf(current)

  const isWindowsInstaller = (asset) => /^Git-\d+\.\d+\.\d+-64-bit\.exe$/.test(asset.name)
  const fromRelease = (release) => {
    const asset = (release.assets ?? []).find(isWindowsInstaller)
    if (!asset) return null
    const version = asset.name.match(/^Git-(\d+\.\d+\.\d+)-64-bit\.exe$/)[1]
    if (!ALLOW_MAJOR && majorOf(version) !== wantedMajor) return null
    return { version, release: String(release.tag_name).replace(/^v/, '') }
  }

  const latest = await getJson('https://api.github.com/repos/git-for-windows/git/releases/latest')
  const direct = fromRelease(latest)
  if (direct) return direct

  if (!ALLOW_MAJOR) {
    const releases = await getJson(
      'https://api.github.com/repos/git-for-windows/git/releases?per_page=30',
    )
    for (const release of releases) {
      const found = fromRelease(release)
      if (found) return found
    }
  }
  return null
}

async function latestJava(current) {
  const feature = ALLOW_MAJOR ? await latestLtsJavaFeature() : majorOf(current)
  const release = await getJson(
    `https://api.github.com/repos/adoptium/temurin${feature}-binaries/releases/latest`,
  )
  const pattern = new RegExp(
    `^OpenJDK${feature}U-jdk_x64_windows_hotspot_(\\d+\\.\\d+\\.\\d+)_(\\d+)\\.msi$`,
  )
  for (const asset of release.assets ?? []) {
    const match = asset.name.match(pattern)
    if (match) return { version: match[1], build: match[2] }
  }
  return null
}

async function latestLtsJavaFeature() {
  const info = await getJson('https://api.adoptium.net/v3/info/available_releases')
  return String(Math.max(...(info.available_lts_releases ?? [21])))
}

// ---------------------------------------------------------------------------
// URL verification
// ---------------------------------------------------------------------------

function pinnedUrls(v) {
  return {
    python: [`https://www.python.org/ftp/python/${v.python}/python-${v.python}-amd64.exe`],
    node: [`https://nodejs.org/dist/v${v.node}/node-v${v.node}-x64.msi`],
    java: [
      `https://github.com/adoptium/temurin${majorOf(v.java)}-binaries/releases/download/jdk-${v.java}%2B${v.javaBuild}/OpenJDK${majorOf(v.java)}U-jdk_x64_windows_hotspot_${v.java}_${v.javaBuild}.msi`,
    ],
    go: [
      `https://go.dev/dl/go${v.go}.windows-amd64.msi`,
      `https://go.dev/dl/go${v.go}.linux-amd64.tar.gz`,
    ],
    dotnet: [
      `https://dotnet.microsoft.com/en-us/download/dotnet/thank-you/sdk-${v.dotnet}-windows-x64-installer`,
    ],
    git: [
      `https://github.com/git-for-windows/git/releases/download/v${v.gitWindowsRelease}/Git-${v.gitWindows}-64-bit.exe`,
    ],
  }
}

async function verifyRedirects(rows) {
  const statics = [
    ['LM Studio (Windows)', 'https://lmstudio.ai/download/latest/win32/x64'],
    ['LM Studio (macOS)', 'https://lmstudio.ai/download/latest/darwin/arm64'],
  ]
  for (const [label, url] of statics) {
    const res = await checkUrl(url)
    rows.push({
      tool: label,
      from: 'latest',
      to: 'latest',
      status: res.ok ? 'redirect ok' : `error: URL ${res.status || 'timeout'}`,
      source: 'lmstudio.ai/download',
    })
  }
}

async function checkUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { range: 'bytes=0-0', 'user-agent': 'fastvibe-version-updater' },
      redirect: 'follow',
      signal: AbortSignal.timeout(25_000),
    })
    if (res.status === 404 || res.status === 410) return { ok: false, status: res.status }
    return { ok: res.status < 400, status: res.status, unverified: res.status >= 400 }
  } catch (err) {
    return { ok: false, status: 0, unverified: true, error: err.message }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const TOOLS = [
  { id: 'python', label: 'Python', source: 'endoflife.date/python', pinned: true, fetch: latestPython },
  { id: 'node', label: 'Node.js', source: 'nodejs.org/dist/index.json', pinned: true, fetch: latestNode },
  { id: 'go', label: 'Go', source: 'go.dev/dl', pinned: true, fetch: latestGo },
  { id: 'dotnet', label: '.NET SDK', source: 'dotnetcli release-metadata', pinned: true, fetch: latestDotnet },
  { id: 'git', label: 'Git for Windows', source: 'github/git-for-windows releases', pinned: true, fetch: latestGitWindows },
  { id: 'java', label: 'Java (Temurin)', source: 'github/adoptium temurin releases', pinned: true, fetch: latestJava },
]

async function main() {
  const source = await readFile(VERSIONS_FILE, 'utf8')
  const current = parseVersions(source)
  const next = { ...current }
  const rows = []

  for (const tool of TOOLS) {
    if (tool.manual) {
      rows.push({ tool: tool.label, from: '—', to: '—', status: 'manual', source: tool.source })
      continue
    }

    const before =
      tool.id === 'git'
        ? current.gitWindows
        : tool.id === 'java'
          ? `${current.java}+${current.javaBuild}`
          : current[tool.id]
    try {
      const result = await tool.fetch(before)
      if (!result) {
        rows.push({ tool: tool.label, from: before, to: before, status: 'sin datos', source: tool.source })
        continue
      }

      if (tool.id === 'git') {
        const changed = result.version !== current.gitWindows || result.release !== current.gitWindowsRelease
        if (changed) {
          next.gitWindows = result.version
          next.gitWindowsRelease = result.release
        }
        rows.push({
          tool: tool.label,
          from: current.gitWindows,
          to: result.version,
          status: changed ? 'actualizado' : 'al día',
          source: tool.source,
        })
      } else if (tool.id === 'java') {
        const changed = result.version !== current.java || result.build !== current.javaBuild
        if (changed) {
          next.java = result.version
          next.javaBuild = result.build
        }
        rows.push({
          tool: tool.label,
          from: `${current.java}+${current.javaBuild}`,
          to: `${result.version}+${result.build}`,
          status: changed ? 'actualizado' : 'al día',
          source: tool.source,
        })
      } else {
        const changed = compareVersions(result, before) !== 0
        if (changed && compareVersions(result, before) > 0) next[tool.id] = result
        rows.push({
          tool: tool.label,
          from: before,
          to: result,
          status: changed && compareVersions(result, before) > 0 ? 'actualizado' : 'al día',
          source: tool.source,
        })
      }
    } catch (err) {
      rows.push({ tool: tool.label, from: before, to: before, status: `error: ${err.message}`, source: tool.source })
    }
  }

  // Verify every candidate URL before writing. A dead link is never pinned.
  if (VERIFY_URLS) {
    for (const [key, urls] of Object.entries(pinnedUrls(next))) {
      for (const url of urls) {
        const res = await checkUrl(url)
        const row = rows.find((r) => r.tool === (TOOLS.find((t) => t.id === key)?.label ?? key))
        if (!res.ok && !res.unverified) {
          // Roll back that tool to the previous pinned value.
          if (key === 'git') {
            next.gitWindows = current.gitWindows
            next.gitWindowsRelease = current.gitWindowsRelease
          } else if (key === 'java') {
            next.java = current.java
            next.javaBuild = current.javaBuild
          } else if (key in current) {
            next[key] = current[key]
          }
          if (row) row.status = `error: URL ${res.status}`
        } else if (res.unverified && row && row.status === 'al día') {
          row.status = `al día (URL sin verificar: ${res.status || 'timeout'})`
        }
      }
    }
    await verifyRedirects(rows)
  }

  delete next.lmstudio

  const keys = [...new Set([...Object.keys(current), ...Object.keys(next)])]
  const changes = keys.filter((k) => current[k] !== next[k])
  const ORDER = ['python', 'node', 'java', 'javaBuild', 'go', 'dotnet', 'gitWindows', 'gitWindowsRelease']
  const rendered = renderVersions(
    Object.fromEntries(ORDER.filter((k) => next[k] !== undefined).map((k) => [k, next[k]])),
  )

  if (!CHECK_ONLY && changes.length > 0) {
    await writeFile(VERSIONS_FILE, rendered, 'utf8')
  }

  const markdown = toMarkdown(rows, changes, current, next)
  process.stdout.write(markdown + '\n')

  if (REPORT_FILE) {
    await writeFile(REPORT_FILE, markdown + '\n', 'utf8')
  }

  const attempted = rows.filter((r) => r.status !== 'manual')
  if (attempted.length > 0 && attempted.every((r) => r.status.startsWith('error'))) {
    console.error('Todas las fuentes fallaron; no se modificó nada.')
    process.exit(2)
  }

  if (CHECK_ONLY && changes.length > 0) {
    console.error(`${changes.length} actualización(es) disponible(s): ${changes.join(', ')}`)
    process.exit(1)
  }
}

function toMarkdown(rows, changes, current, next) {
  const lines = []
  lines.push('# FastVibe — tool version refresh')
  lines.push('')
  lines.push(`Modo: ${ALLOW_MAJOR ? '**incluye saltos de versión mayor**' : 'solo patch/minor dentro de la misma línea'}`)
  lines.push('')
  lines.push('| Herramienta | Antes | Detectada | Estado | Fuente |')
  lines.push('|---|---|---|---|---|')
  for (const r of rows) {
    lines.push(`| ${r.tool} | \`${r.from}\` | \`${r.to}\` | ${r.status} | ${r.source} |`)
  }
  lines.push('')
  if (changes.length === 0) {
    lines.push('Sin cambios: todo está en la última versión compatible.')
  } else {
    lines.push(`**${changes.length} cambio(s):**`)
    for (const key of changes) lines.push(`- \`${key}\`: \`${current[key]}\` → \`${next[key]}\``)
  }
  lines.push('')
  lines.push('> `java` se pinnea desde Adoptium Temurin LTS y `lmstudio` usa un redirect estable a la última versión. Ambas URLs se verifican en cada corrida.')
  return lines.join('\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
