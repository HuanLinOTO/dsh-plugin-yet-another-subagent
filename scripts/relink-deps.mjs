/**
 * Relink peer-dep junctions to the BUILT dsh packages under
 * $DSH_HOME/source/current (or ~/.dsh/source/current), not the unbuilt
 * `../dsh` dev checkout. The dev-checkout junctions have no `lib/` output,
 * so `tsc` (types) and `dsh web` (runtime) both fail without this relink.
 *
 * Run automatically as a `prebuild` step; safe to run repeatedly.
 */
import { existsSync, rmSync, symlinkSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const BUILT = process.env.DSH_SOURCE_ROOT || join(DSH_HOME, 'source', 'current')
const NODE_MODULES = resolve('node_modules')

const LINKS = {
  'cordis': join(BUILT, 'vendor', 'cordis'),
  '@deepseek-ai/schemastery': join(BUILT, 'vendor', 'schemastery'),
  '@deepseek-ai/dsh-agent': join(BUILT, 'packages', 'core', 'agent'),
  '@deepseek-ai/dsh-api-gateway': join(BUILT, 'packages', 'api', 'gateway'),
  '@deepseek-ai/dsh-api-session-controller': join(BUILT, 'packages', 'api', 'session-controller'),
  '@deepseek-ai/dsh-client-connection': join(BUILT, 'packages', 'client', 'connection'),
  '@deepseek-ai/dsh-client-locale': join(BUILT, 'packages', 'client', 'locale'),
  '@deepseek-ai/dsh-client-ui-conversation': join(BUILT, 'packages', 'client', 'ui-conversation'),
  '@deepseek-ai/dsh-client-ui-primitives': join(BUILT, 'packages', 'client', 'ui-primitives'),
  '@deepseek-ai/dsh-client-ui-settings': join(BUILT, 'packages', 'client', 'ui-settings'),
  '@deepseek-ai/dsh-client-ui-slots': join(BUILT, 'packages', 'client', 'ui-slots'),
  '@deepseek-ai/dsh-client-ui-renderer': join(BUILT, 'packages', 'client', 'ui-renderer'),
  '@deepseek-ai/dsh-client-ui-tool': join(BUILT, 'packages', 'client', 'ui-tool'),
  '@deepseek-ai/dsh-jobs': join(BUILT, 'packages', 'jobs', 'jobs'),
  '@deepseek-ai/dsh-llm': join(BUILT, 'packages', 'llm', 'llm'),
  '@deepseek-ai/dsh-session': join(BUILT, 'packages', 'core', 'session'),
  '@deepseek-ai/dsh-session-projection': join(BUILT, 'packages', 'session', 'session-projection'),
  '@deepseek-ai/dsh-settings': join(BUILT, 'packages', 'settings', 'settings'),
  '@deepseek-ai/dsh-subagent': join(BUILT, 'packages', 'subagent', 'subagent'),
  '@deepseek-ai/dsh-tools': join(BUILT, 'packages', 'core', 'tools'),
  '@deepseek-ai/dsh-util-values': join(BUILT, 'packages', 'util', 'values'),
}

if (!existsSync(BUILT)) {
  console.error(`[relink-deps] built dsh not found at ${BUILT}`)
  console.error(`[relink-deps] run 'dsh' once to populate $DSH_HOME/source/current, then retry`)
  process.exit(1)
}

let changed = 0
for (const [relPath, target] of Object.entries(LINKS)) {
  const linkPath = join(NODE_MODULES, relPath)
  if (!existsSync(target)) {
    console.warn(`[relink-deps] SKIP ${relPath}: target not found at ${target}`)
    continue
  }
  if (existsSync(linkPath)) {
    try {
      const stat = statSync(linkPath)
      if (stat.isSymbolicLink()) {
        rmSync(linkPath, { recursive: true, force: true })
      } else {
        rmSync(linkPath, { recursive: true, force: true })
      }
    } catch {
      // junction or dir — force remove
      rmSync(linkPath, { recursive: true, force: true })
    }
  }
  const parent = linkPath.slice(0, linkPath.lastIndexOf(relPath.includes('/') ? '/' : '\\'))
  if (!existsSync(parent)) {
    await import('node:fs').then(fs => fs.mkdirSync(parent, { recursive: true }))
  }
  symlinkSync(target, linkPath, 'junction')
  changed++
}

console.log(`[relink-deps] relinked ${changed} packages to ${BUILT}`)
