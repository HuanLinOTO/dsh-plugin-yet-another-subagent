import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

type LocaleMeta = { meta?: { title?: unknown, description?: unknown } }

function readLocaleMeta(language: string): LocaleMeta['meta'] {
  const file = resolve(packageRoot, 'locale', `${language}.json`)
  return (JSON.parse(readFileSync(file, 'utf8')) as LocaleMeta).meta
}

describe('locale meta', () => {
  it.each(['en', 'zh'])('%s.json exposes non-empty meta fields', (language) => {
    const meta = readLocaleMeta(language)
    expect(meta).toBeTypeOf('object')
    for (const field of ['title', 'description'] as const) {
      const value = meta?.[field]
      expect(value).toBeTypeOf('string')
      expect((value as string).trim()).not.toBe('')
    }
  })

  it('package.json exports and ships the locale directory', () => {
    const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
      exports: Record<string, string>
      files: string[]
    }
    expect(manifest.exports['./locale/*.json']).toBe('./locale/*.json')
    expect(manifest.files).toContain('locale/')
  })
})
