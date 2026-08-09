import { describe, expect, it, vi } from 'vitest'
import { ProfileStore } from '../src/profile-store.ts'
import type { SubagentProfile, YaSubagentConfig } from '../src/types.ts'

function makeProfile(overrides: Partial<SubagentProfile> = {}): SubagentProfile {
  return {
    id: 'general',
    label: 'General',
    model: { kind: 'auto', provider: '', model: '' },
    persona: { kind: 'inherit' },
    toolFilter: { kind: 'none' },
    maxDepth: 3,
    backgroundMode: 'continuable',
    builtin: false,
    ...overrides,
  }
}

function makeStore(seed: Partial<YaSubagentConfig> = {}): ProfileStore {
  return new ProfileStore({
    profiles: seed.profiles ?? [makeProfile()],
    generalFixed: seed.generalFixed ?? true,
  })
}

/** Minimal in-memory SettingsScope double: tracks replace() calls. */
function makeScopeStub<T>(value: T): {
  scope: {
    get(): T
    watch(cb: () => void): () => void
    replace(next: object): Promise<void>
    update(patch: object): Promise<void>
  }
  replaceCalls: T[]
  notify: () => void
} {
  let current = value
  const watchers = new Set<() => void>()
  const replaceCalls: T[] = []
  return {
    scope: {
      get: () => current,
      watch: (cb: () => void) => {
        watchers.add(cb)
        return () => { watchers.delete(cb) }
      },
      replace: async (next: object) => {
        current = next as T
        replaceCalls.push(structuredClone(current) as T)
        for (const w of [...watchers]) w()
      },
      update: async (patch: object) => {
        current = { ...current, ...(patch as Partial<T>) } as T
        replaceCalls.push(structuredClone(current) as T)
        for (const w of [...watchers]) w()
      },
    },
    replaceCalls,
    notify: () => { for (const w of [...watchers]) w() },
  }
}

describe('ProfileStore — settings scope persistence', () => {
  it('reloads from scope on attachScope', () => {
    const store = makeStore({ profiles: [makeProfile({ id: 'general' })] })
    const settings = {
      profiles: [makeProfile({ id: 'general', label: 'From Settings' }), makeProfile({ id: 'research' })],
      generalFixed: true,
    }
    const { scope } = makeScopeStub(settings)
    store.attachScope(scope)
    expect(store.list().map(p => p.id)).toEqual(['general', 'research'])
    expect(store.get('general')?.label).toBe('From Settings')
  })

  it('persists through scope.replace on add', async () => {
    const store = makeStore()
    const settings = { profiles: [makeProfile()], generalFixed: true }
    const { scope, replaceCalls } = makeScopeStub(settings)
    store.attachScope(scope)
    store.add(makeProfile({ id: 'research', label: 'Research' }))
    // replace is async; flush microtasks
    await Promise.resolve()
    expect(replaceCalls.at(-1)?.profiles.map(p => p.id)).toEqual(['general', 'research'])
  })

  it('persists through scope.replace on update', async () => {
    const store = makeStore()
    const settings = { profiles: [makeProfile()], generalFixed: true }
    const { scope, replaceCalls } = makeScopeStub(settings)
    store.attachScope(scope)
    store.update(makeProfile({ id: 'general', label: 'Updated' }))
    await Promise.resolve()
    expect(replaceCalls.at(-1)?.profiles[0]?.label).toBe('Updated')
  })

  it('persists through scope.replace on remove', async () => {
    const store = makeStore({
      profiles: [makeProfile({ id: 'general' }), makeProfile({ id: 'research' })],
      generalFixed: false,
    })
    const settings = {
      profiles: [makeProfile({ id: 'general' }), makeProfile({ id: 'research' })],
      generalFixed: false,
    }
    const { scope, replaceCalls } = makeScopeStub(settings)
    store.attachScope(scope)
    store.remove('research')
    await Promise.resolve()
    expect(replaceCalls.at(-1)?.profiles.map(p => p.id)).toEqual(['general'])
  })

  it('reloadFromScope picks up external edits', () => {
    const store = makeStore()
    let current: { profiles: readonly SubagentProfile[]; generalFixed: boolean } = {
      profiles: [makeProfile()],
      generalFixed: true,
    }
    const watchers = new Set<() => void>()
    const scope = {
      get: () => current,
      watch: (cb: () => void) => { watchers.add(cb); return () => { watchers.delete(cb) } },
      replace: async (next: object) => { current = next as typeof current; for (const w of [...watchers]) w() },
      update: async (patch: object) => { current = { ...current, ...(patch as Partial<typeof current>) }; for (const w of [...watchers]) w() },
    }
    store.attachScope(scope)
    // Simulate an external edit: another tab writes to settings.yaml.
    current = {
      profiles: [makeProfile({ id: 'general', label: 'External' }), makeProfile({ id: 'new' })],
      generalFixed: true,
    }
    // store.watch fires → host apply calls reloadFromScope.
    store.reloadFromScope()
    expect(store.list().map(p => p.id)).toEqual(['general', 'new'])
    expect(store.get('general')?.label).toBe('External')
  })

  it('falls back to in-memory when no scope is attached', async () => {
    const store = makeStore()
    // No attachScope call — headless mode.
    const result = store.add(makeProfile({ id: 'research' }))
    expect(result.ok).toBe(true)
    // No scope.replace to await; the in-memory map IS the source of truth.
    expect(store.list().map(p => p.id)).toEqual(['general', 'research'])
  })
})
