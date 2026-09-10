import { describe, expect, it } from 'vitest'
import { Context, type Context as Ctx } from 'cordis'
import { registerRpc } from '../src/rpc.ts'
import { ProfileStore } from '../src/profile-store.ts'
import type { SubagentProfile, YaSubagentConfig } from '../src/types.ts'
import type { ConnectionFetchRoute, HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
import { apply as connectionApply, inject as connectionInject } from '@deepseek-ai/dsh-client-connection'

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

interface Harness {
  ctx: Ctx
  routes: Map<string, ConnectionFetchRoute>
}

/** Boot registerRpc against a headless context with a capturing connection face. */
async function boot(seed?: Partial<YaSubagentConfig>, store?: ProfileStore): Promise<Harness> {
  const ctx = new Context() as Ctx
  const routes = new Map<string, ConnectionFetchRoute>()
  registerRpc(ctx, store ?? makeStore(seed))
  ctx.provide('connection', {
    fetch: {
      register: (route: ConnectionFetchRoute) => {
        routes.set(route.path, route)
        return async () => { routes.delete(route.path) }
      },
    },
  })
  // The derived inject fiber activates on the next microtask after provide.
  await new Promise(resolve => setTimeout(resolve, 20))
  return { ctx, routes }
}

/** One well-formed Connection RPC request for a ya-subagent endpoint. */
function rpcRequest(endpoint: string, payload: unknown, rpcId = 'rpc-test-1'): Request {
  return new Request(`http://127.0.0.1:3080/api/ya-subagent.${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId, method: `ya-subagent.${endpoint}`, payload }),
  })
}

describe('registerRpc exact Fetch routes', () => {
  it('registers one buffered POST route per endpoint below /api', async () => {
    const { routes } = await boot()
    const paths = [...routes.keys()]
    expect(paths).toContain('/api/ya-subagent.profiles.list')
    expect(paths).toContain('/api/ya-subagent.profiles.add')
    expect(paths).toContain('/api/ya-subagent.profiles.update')
    expect(paths).toContain('/api/ya-subagent.profiles.remove')
    expect(paths).toContain('/api/ya-subagent.tools.list')
    expect(paths).toContain('/api/ya-subagent.sessions.repair')
    for (const route of routes.values()) {
      expect(route.methods).toEqual(['POST'])
      expect(route.requestBody).toBe('buffered')
    }
  })

  it('answers profiles.list with the store contents in a server-response envelope', async () => {
    const { routes } = await boot()
    const response = await routes.get('/api/ya-subagent.profiles.list')!.fetch(rpcRequest('profiles.list', {}))
    expect(response.status).toBe(200)
    const body = await response.json() as {
      type: string
      rpcId: string
      result: { ok: boolean; value: { profiles: SubagentProfile[] } }
    }
    expect(body.type).toBe('server-response')
    expect(body.rpcId).toBe('rpc-test-1')
    expect(body.result.ok).toBe(true)
    expect(body.result.value.profiles.map(p => p.id)).toEqual(['general'])
  })

  it('persists profiles.add through the store and returns the new list', async () => {
    const { routes } = await boot()
    const response = await routes.get('/api/ya-subagent.profiles.add')!.fetch(
      rpcRequest('profiles.add', { profile: makeProfile({ id: 'research', label: 'Research' }) }),
    )
    const body = await response.json() as { result: { ok: boolean; value: { profiles: SubagentProfile[] } } }
    expect(body.result.ok).toBe(true)
    expect(body.result.value.profiles.map(p => p.id)).toEqual(['general', 'research'])
  })

  it('removes a removable profile through profiles.remove', async () => {
    const store = makeStore({
      profiles: [makeProfile(), makeProfile({ id: 'temp', label: 'Temp' })],
    })
    const { routes } = await boot({}, store)
    const response = await routes.get('/api/ya-subagent.profiles.remove')!.fetch(
      rpcRequest('profiles.remove', { id: 'temp' }),
    )
    const body = await response.json() as { result: { ok: boolean; value: { profiles: SubagentProfile[] } } }
    expect(body.result.ok).toBe(true)
    expect(body.result.value.profiles.map(p => p.id)).toEqual(['general'])
  })

  it('rejects a method that does not match the route endpoint', async () => {
    const { routes } = await boot()
    const forged = new Request('http://127.0.0.1:3080/api/ya-subagent.profiles.list', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'rpc-x', method: 'ya-subagent.profiles.remove', payload: {} }),
    })
    const response = await routes.get('/api/ya-subagent.profiles.list')!.fetch(forged)
    const body = await response.json() as { rpcId: string; result: { ok: boolean; error: { message: string } } }
    expect(body.rpcId).toBe('rpc-x')
    expect(body.result.ok).toBe(false)
    expect(body.result.error.message).toContain('does not match endpoint')
  })

  it('rejects a malformed envelope with the invalid-request rpc id', async () => {
    const { routes } = await boot()
    const malformed = new Request('http://127.0.0.1:3080/api/ya-subagent.profiles.list', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'server-response', rpcId: 'rpc-y' }),
    })
    const response = await routes.get('/api/ya-subagent.profiles.list')!.fetch(malformed)
    const body = await response.json() as { rpcId: string; result: { ok: boolean } }
    expect(body.rpcId).toBe('invalid-request')
    expect(body.result.ok).toBe(false)
  })

  it('answers 415 for a non-JSON content type and 400 for a non-JSON body', async () => {
    const { routes } = await boot()
    const route = routes.get('/api/ya-subagent.profiles.list')!
    const wrongType = new Request('http://127.0.0.1:3080/api/ya-subagent.profiles.list', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{}',
    })
    expect((await route.fetch(wrongType)).status).toBe(415)
    const notJson = new Request('http://127.0.0.1:3080/api/ya-subagent.profiles.list', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    })
    expect((await route.fetch(notJson)).status).toBe(400)
  })

  it('mounts and dispatches through the real /api carrier in the web-profile sibling topology', async () => {
    // Production shape: the webserver service is provided by a SIBLING plugin
    // fiber (loader rows are peers, never ancestors of the connection fiber).
    // The dedicated-channel registry cannot mount here; exact Fetch routes must.
    const ctx = new Context() as Ctx
    const credentials = {
      modifyRecord: async (
        key: string,
        update: (current: unknown) => Promise<{ kind: 'grant'; payload: unknown } | undefined>,
      ) => {
        const decision = await update(secretStore.get(key))
        if (decision !== undefined) secretStore.set(key, decision.payload)
        return secretStore.has(key) ? { kind: 'grant', payload: secretStore.get(key) } : undefined
      },
    }
    const secretStore = new Map<string, unknown>()
    ctx.provide('credentials', credentials)
    ctx.plugin({ apply: (c: Ctx) => { c.provide('webServer', { register: () => () => {} }) } })
    const connFiber = ctx.plugin({ inject: [...connectionInject], apply: connectionApply }, {})
    await connFiber.await()
    const consumer = ctx.plugin({
      inject: ['connection'],
      apply: (c: Ctx) => { registerRpc(c, makeStore()) },
    })
    await consumer.await()
    // registerRpc's derived inject fiber registers on the next microtask.
    await new Promise(resolve => setTimeout(resolve, 20))
    const connection = ctx.get('connection') as unknown as HostConnectionHandle
    const shared = connection.createSharedFetchHandler('/api')
    const request = new Request('http://127.0.0.1:3080/api/ya-subagent.profiles.list', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'client-request',
        rpcId: 'rpc-topology-1',
        method: 'ya-subagent.profiles.list',
        payload: {},
      }),
    })
    const response = await shared.fetch(request)
    expect(response.status).toBe(200)
    const body = await response.json() as {
      type: string
      rpcId: string
      result: { ok: boolean; value: { profiles: SubagentProfile[] } }
    }
    expect(body.type).toBe('server-response')
    expect(body.rpcId).toBe('rpc-topology-1')
    expect(body.result.ok).toBe(true)
    expect(body.result.value.profiles.map(p => p.id)).toEqual(['general'])
  })
})
