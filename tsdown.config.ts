/**
 * Dev/CI tsdown config: emits three artifacts:
 *
 *   - `lib/index.js`      — node half (plain ESM, bundles src/index.ts)
 *   - `lib/invariant.js`  — node half (plain ESM, bundles src/invariant.ts)
 *   - `lib/client.js`     — browser half (CJS wrapped in DSH's
 *                            `window.__ModuleLoader__.load({id, factory})`
 *                            so the client module loader can compose it)
 *
 * The browser bundle externals React and the DSH platform modules (cordis,
 * @deepseek-ai/dsh-client-*) — the loader's module table provides them at
 * runtime. Everything else (zod, inline-safe wire layers) bundles in.
 *
 * CSS Modules: each `.module.css` import is inlined as a hashed class map
 * + a `<style data-plugin>` tag injected at factory execution (matching the
 * DSH `clientBundle` factory's `dsh-css-modules-inline` plugin, but using
 * a minimal local transform instead of lightningcss to avoid the dependency).
 */
import { defineConfig, type UserConfig } from 'tsdown'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, resolve as resolvePath } from 'node:path'

const ID = '@dsh-external/yet-another-subagent'

/** DSH platform modules that stay external in the browser bundle. */
const CLIENT_EXTERNALS = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'cordis',
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-locale/client',
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-connection/client',
  '@deepseek-ai/dsh-client-ui-tool',
  '@deepseek-ai/dsh-client-ui-tool/client',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-ui-settings/client',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-conversation',
  '@deepseek-ai/dsh-client-ui-conversation/client',
  '@deepseek-ai/dsh-client-ui-slash',
  '@deepseek-ai/dsh-client-ui-slash/client',
  '@deepseek-ai/dsh-client-web-react',
]

/** Virtual-id wrapper keeping module CSS away from rolldown's CSS pipeline. */
const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** Minimal CSS-modules transform: hash local names, return class map + raw CSS. */
function transformCssModules(filename: string, source: Buffer): { classMap: Record<string, string>; cssText: string } {
  // Stable hash from the absolute path: `[hash]_[local]` shape matching DSH.
  // Prefix with 'd' to guarantee the class name starts with a letter — CSS
  // identifiers (and thus class selectors) cannot start with a digit, and
  // toString(36) can yield a leading digit (e.g. "8sln8w" → invalid .8sln8w_card).
  const rawHash = Array.from(filename).reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0).toString(36).replace('-', '')
  const hash = `d${rawHash}`
  const cssText = source.toString('utf8')
  // Collect every `.identifier` occurrence in the stylesheet — including
  // comma-separated selectors (`.a, .b {}`), descendant combinators
  // (`.parent .child {}`), and pseudo-states (`.a:hover`). A class is any
  // `.` followed by an identifier char, regardless of what comes next.
  const classMap: Record<string, string> = {}
  const classPattern = /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g
  let match: RegExpExecArray | null
  while ((match = classPattern.exec(cssText)) !== null) {
    const local = match[1]
    if (local !== undefined && classMap[local] === undefined) {
      classMap[local] = `${hash}_${local}`
    }
  }
  // Replace every `.local` with `.${hash}_local`. A class not in the map
  // (none, since we collected all) stays as-is; the regex is the same shape
  // so every occurrence is replaced exactly once.
  const transformedCss = cssText.replace(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g, (full, name: string) => {
    if (classMap[name] !== undefined) return `.${classMap[name]}`
    return full
  })
  return { classMap, cssText: transformedCss }
}

/** Resolve an emitted JS asset import against its source-tree counterpart. */
function sourceAssetPath(source: string, importer: string): string {
  const emitted = resolvePath(dirname(importer), source)
  if (existsSync(emitted)) return emitted
  const marker = `${resolvePath('.').split(/[\\/]/).pop()}${resolvePath('.').includes('lib') ? '' : ''}`
  void marker
  return emitted
}

const cssModulesPlugin = {
  name: 'dsh-css-modules-inline',
  resolveId(source: string, importer: string | undefined) {
    if (!source.endsWith('.module.css')) return null
    const abs = importer !== undefined ? sourceAssetPath(source, importer) : source
    return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
  },
  async load(virtualId: string) {
    if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
    const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
    this.addWatchFile(fileId)
    const source = await readFile(fileId)
    const { classMap, cssText } = transformCssModules(fileId, source)
    const tagId = `${ID}/${basename(fileId)}`
    return [
      `const css = ${JSON.stringify(cssText)};`,
      `const classMap = ${JSON.stringify(classMap)};`,
      `const tagId = ${JSON.stringify(tagId)};`,
      'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
      '  const tag = document.createElement(\'style\');',
      `  tag.dataset.plugin = ${JSON.stringify(ID)};`,
      '  tag.dataset.pluginCss = tagId;',
      '  tag.textContent = css;',
      '  document.head.appendChild(tag);',
      '}',
      'export default classMap;',
    ].join('\n')
  },
}

const libConfig: UserConfig = {
  name: ID,
  entry: { index: 'src/index.ts', invariant: 'src/invariant.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  dts: false,
  clean: true,
}

const clientBundleConfig: UserConfig = {
  name: `${ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: ['cjs'],
  platform: 'browser',
  target: 'es2024',
  dts: false,
  sourcemap: true,
  clean: false,
  external: CLIENT_EXTERNALS,
  noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  plugins: [cssModulesPlugin],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default defineConfig([libConfig, clientBundleConfig])
