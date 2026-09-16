#!/usr/bin/env node
/**
 * Fails the build if source code imports a package that package.json doesn't declare.
 *
 * Why this exists: on 2026-09-16 three deploys failed because `zustand` was present
 * in local node_modules but missing from package.json. `npm run build` passed locally
 * and failed on Vercel, which installs only what package.json declares. A local build
 * is not evidence that a clean-room build will pass.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { builtinModules } from 'node:module'

const ROOT = process.cwd()
const SCAN_DIRS = ['src', 'api']
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'])

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
])

const builtins = new Set([...builtinModules, ...builtinModules.map(m => `node:${m}`)])

function walk(dir) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const e of entries) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const full = join(dir, e)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (EXTS.has(extname(full))) out.push(full)
  }
  return out
}

// Matches: import ... from 'x'  |  export ... from 'x'  |  import('x')  |  require('x')
const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*['"]([^'"]+)['"]/g

/** 'react-dom/client' -> 'react-dom';  '@scope/pkg/sub' -> '@scope/pkg' */
function toPackageName(spec) {
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

const missing = new Map() // pkgName -> Set<file>

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1]
      // Skip relative, absolute, alias, url, and bare-asset imports
      if (/^[./]/.test(spec) || /^(https?:)?\/\//.test(spec) || spec.startsWith('~')) continue
      if (builtins.has(spec)) continue

      const name = toPackageName(spec)
      if (builtins.has(name) || declared.has(name)) continue

      // Type-only imports resolved via a types package (e.g. 'node' -> @types/node)
      if (declared.has(`@types/${name}`)) continue

      if (!missing.has(name)) missing.set(name, new Set())
      missing.get(name).add(file.replace(ROOT + '/', ''))
    }
  }
}

if (missing.size > 0) {
  console.error('\n✗ Imported but not declared in package.json:\n')
  for (const [name, files] of missing) {
    console.error(`  ${name}`)
    for (const f of files) console.error(`      ${f}`)
  }
  console.error(
    `\n  These resolve locally but will fail a clean install (Vercel, CI, fresh clone).` +
    `\n  Fix: npm install ${[...missing.keys()].join(' ')}\n`
  )
  process.exit(1)
}

console.log(`✓ deps: all imports across ${SCAN_DIRS.join('/')} are declared`)
