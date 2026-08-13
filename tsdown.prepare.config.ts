/**
 * Consumption-side tsdown config: runs at `pnpm install` time via the
 * `prepare` script. Self-contained: no sibling checkout resolution, no
 * typecheck (type gates belong to dev/CI). Emits three ESM bundles from
 * src/ into lib/.
 */
import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    dts: false,
    clean: true,
  },
  {
    entry: ['src/invariant.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    dts: false,
    clean: false,
  },
  {
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    external: [
      'react',
      'react-dom',
      '@deepseek-ai/cordis',
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
    ],
  },
])
