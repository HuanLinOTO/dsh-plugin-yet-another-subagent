import { describe, expect, it } from 'vitest'
import { ProfileStore } from '../src/profile-store.ts'
import { migrateProfile } from '../src/types.ts'
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

describe('ProfileStore', () => {
  describe('constructor', () => {
    it('seeds profiles from config', () => {
      const store = makeStore({
        profiles: [
          makeProfile({ id: 'general', label: 'General' }),
          makeProfile({ id: 'research', label: 'Research' }),
        ],
      })
      expect(store.list().map(p => p.id)).toEqual(['general', 'research'])
    })

    it('preserves generalFixed flag', () => {
      expect(makeStore({ generalFixed: true }).generalFixed).toBe(true)
      expect(makeStore({ generalFixed: false }).generalFixed).toBe(false)
    })
  })

  describe('add', () => {
    it('adds a new profile', () => {
      const store = makeStore()
      const result = store.add(makeProfile({ id: 'research', label: 'Research' }))
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.profiles.map(p => p.id)).toEqual(['general', 'research'])
      }
    })

    it('rejects a duplicate id', () => {
      const store = makeStore()
      const result = store.add(makeProfile({ id: 'general' }))
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('already exists')
      }
    })

    it('rejects an invalid id', () => {
      const store = makeStore()
      const result = store.add(makeProfile({ id: 'UPPER_CASE' }))
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('invalid profile id')
      }
    })

    it('rejects a negative maxDepth', () => {
      const store = makeStore()
      const result = store.add(makeProfile({ id: 'neg', maxDepth: -1 }))
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('maxDepth')
      }
    })

    it('rejects a non-integer maxDepth', () => {
      const store = makeStore()
      const result = store.add(makeProfile({ id: 'frac', maxDepth: 1.5 }))
      expect(result.ok).toBe(false)
    })
  })

  describe('update', () => {
    it('updates an existing profile', () => {
      const store = makeStore()
      const result = store.update(makeProfile({ id: 'general', label: 'Updated' }))
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.profiles[0]?.label).toBe('Updated')
      }
    })

    it('rejects an unknown id', () => {
      const store = makeStore()
      const result = store.update(makeProfile({ id: 'missing' }))
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('not found')
      }
    })
  })

  describe('remove', () => {
    it('removes a non-general profile', () => {
      const store = makeStore({
        profiles: [makeProfile({ id: 'general' }), makeProfile({ id: 'research' })],
      })
      const result = store.remove('research')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.profiles.map(p => p.id)).toEqual(['general'])
      }
    })

    it('protects general when generalFixed is true', () => {
      const store = makeStore({ generalFixed: true })
      const result = store.remove('general')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('fixed')
      }
    })

    it('allows removing general when generalFixed is false', () => {
      const store = makeStore({ generalFixed: false })
      const result = store.remove('general')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.profiles).toEqual([])
      }
    })

    it('rejects an unknown id', () => {
      const store = makeStore()
      const result = store.remove('missing')
      expect(result.ok).toBe(false)
    })
  })

  describe('get', () => {
    it('returns the profile by id', () => {
      const store = makeStore()
      expect(store.get('general')?.label).toBe('General')
    })

    it('returns undefined for unknown id', () => {
      const store = makeStore()
      expect(store.get('missing')).toBeUndefined()
    })
  })

  describe('builtin flag', () => {
    it('preserves builtin=true on seed profiles', () => {
      const store = makeStore({
        profiles: [makeProfile({ id: 'general', builtin: true })],
      })
      expect(store.get('general')?.builtin).toBe(true)
    })

    it('forces builtin=false on RPC add even when caller sends builtin=true', () => {
      const store = makeStore()
      const result = store.add(makeProfile({ id: 'research', builtin: true }))
      expect(result.ok).toBe(true)
      if (result.ok) {
        const added = result.profiles.find(p => p.id === 'research')
        expect(added?.builtin).toBe(false)
      }
    })

    it('preserves the existing builtin flag on update (cannot flip)', () => {
      const store = makeStore({
        profiles: [makeProfile({ id: 'general', builtin: true })],
      })
      // Caller tries to flip builtin to false on a builtin profile.
      const result = store.update(makeProfile({ id: 'general', label: 'Updated', builtin: false }))
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.profiles[0]?.builtin).toBe(true)
      }
    })

    it('cannot promote a non-builtin profile to builtin via update', () => {
      const store = makeStore({
        profiles: [makeProfile({ id: 'general', builtin: true }), makeProfile({ id: 'research', builtin: false })],
      })
      const result = store.update(makeProfile({ id: 'research', label: 'R', builtin: true }))
      expect(result.ok).toBe(true)
      if (result.ok) {
        const r = result.profiles.find(p => p.id === 'research')
        expect(r?.builtin).toBe(false)
      }
    })
  })

  describe('migrateProfile (legacy shape compatibility)', () => {
    it('coerces legacy persona: string to { kind: "custom", text }', () => {
      const migrated = migrateProfile({
        id: 'p',
        label: 'P',
        model: { kind: 'auto' },
        persona: 'You are a reviewer.',
        toolFilter: { allow: ['bash'], deny: [] },
        maxDepth: 2,
      })
      expect(migrated.persona).toEqual({ kind: 'custom', text: 'You are a reviewer.' })
      expect(migrated.toolFilter).toEqual({ kind: 'allow', tools: ['bash'] })
      expect(migrated.builtin).toBe(false)
    })

    it('coerces empty legacy persona to { kind: "inherit" }', () => {
      const migrated = migrateProfile({
        id: 'p',
        label: 'P',
        model: { kind: 'auto' },
        persona: '',
        toolFilter: undefined,
        maxDepth: 0,
      })
      expect(migrated.persona).toEqual({ kind: 'inherit' })
      expect(migrated.toolFilter).toEqual({ kind: 'none' })
    })

    it('coerces legacy toolFilter { deny: [...] } to { kind: "deny", tools }', () => {
      const migrated = migrateProfile({
        id: 'p',
        label: 'P',
        model: { kind: 'auto' },
        persona: undefined,
        toolFilter: { deny: ['bash', 'fs'] },
        maxDepth: 1,
      })
      expect(migrated.toolFilter).toEqual({ kind: 'deny', tools: ['bash', 'fs'] })
    })

    it('coerces legacy toolFilter { allow: [], deny: [] } to { kind: "none" }', () => {
      const migrated = migrateProfile({
        id: 'p',
        label: 'P',
        model: { kind: 'auto' },
        maxDepth: 1,
      })
      expect(migrated.toolFilter).toEqual({ kind: 'none' })
      expect(migrated.persona).toEqual({ kind: 'inherit' })
    })

    it('is idempotent on the new shape', () => {
      const profile = makeProfile({ id: 'x', builtin: true })
      expect(migrateProfile(profile)).toEqual(profile)
    })
  })
})
