import { describe, expect, it } from 'vitest'
import { ProfileStore } from '../src/profile-store.ts'
import type { ProfilePersistence } from '../src/profile-store.ts'
import type { SubagentProfile, YaSubagentConfig } from '../src/types.ts'

function makeProfile(overrides: Partial<SubagentProfile> = {}): SubagentProfile {
  return {
    id: 'general',
    label: 'General',
    model: { kind: 'auto', provider: '', model: '' },
    maxDepth: 1,
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

/**
 * Minimal in-memory persistence double mirroring the settings bridge: `source`
 * reads the committed list, `persist` replaces it and records every commit.
 */
function makePersistenceStub(initial: readonly SubagentProfile[]): {
  persistence: ProfilePersistence
  commits: (readonly SubagentProfile[])[]
} {
  let current: readonly SubagentProfile[] = initial
  const commits: (readonly SubagentProfile[])[] = []
  return {
    persistence: {
      source: () => current,
      persist: async (profiles: readonly SubagentProfile[]) => {
        current = profiles.map(p => ({ ...p }))
        commits.push(current)
      },
    },
    commits,
  }
}

describe('ProfileStore — entry-config persistence', () => {
  it('reloads from the persistence source on attachPersistence', () => {
    const store = makeStore({ profiles: [makeProfile({ id: 'general' })] })
    const { persistence } = makePersistenceStub([
      makeProfile({ id: 'general', label: 'From Config' }),
      makeProfile({ id: 'research' }),
    ])
    store.attachPersistence(persistence)
    expect(store.list().map(p => p.id)).toEqual(['general', 'research'])
    expect(store.get('general')?.label).toBe('From Config')
  })

  it('persists through the face on add', async () => {
    const store = makeStore()
    const { persistence, commits } = makePersistenceStub([makeProfile()])
    store.attachPersistence(persistence)
    store.add(makeProfile({ id: 'research', label: 'Research' }))
    await Promise.resolve()
    expect(commits.at(-1)?.map(p => p.id)).toEqual(['general', 'research'])
  })

  it('persists through the face on update', async () => {
    const store = makeStore()
    const { persistence, commits } = makePersistenceStub([makeProfile()])
    store.attachPersistence(persistence)
    store.update(makeProfile({ id: 'general', label: 'Updated' }))
    await Promise.resolve()
    expect(commits.at(-1)?.[0]?.label).toBe('Updated')
  })

  it('persists through the face on remove', async () => {
    const store = makeStore({
      profiles: [makeProfile({ id: 'general' }), makeProfile({ id: 'research' })],
      generalFixed: false,
    })
    const { persistence, commits } = makePersistenceStub([
      makeProfile({ id: 'general' }),
      makeProfile({ id: 'research' }),
    ])
    store.attachPersistence(persistence)
    store.remove('research')
    await Promise.resolve()
    expect(commits.at(-1)?.map(p => p.id)).toEqual(['general'])
  })

  it('reloadFromPersistence picks up external edits', () => {
    const store = makeStore()
    let current: readonly SubagentProfile[] = [makeProfile()]
    const persistence: ProfilePersistence = {
      source: () => current,
      persist: async (profiles) => { current = profiles },
    }
    store.attachPersistence(persistence)
    // Simulate an external edit: another writer commits to cordis.patch.yml
    // and the entry is re-applied.
    current = [makeProfile({ id: 'general', label: 'External' }), makeProfile({ id: 'new' })]
    store.reloadFromPersistence()
    expect(store.list().map(p => p.id)).toEqual(['general', 'new'])
    expect(store.get('general')?.label).toBe('External')
  })

  it('falls back to in-memory when no persistence face is attached', async () => {
    const store = makeStore()
    // No attachPersistence call — headless mode.
    const result = store.add(makeProfile({ id: 'research' }))
    expect(result.ok).toBe(true)
    // No commit to await; the in-memory map IS the source of truth.
    expect(store.list().map(p => p.id)).toEqual(['general', 'research'])
  })
})
