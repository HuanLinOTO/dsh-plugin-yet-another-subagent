/**
 * Package-owned invariant companion for `@huanlin/dsh-plugin-yet-another-subagent`.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/invariant
 */

/* jscpd:ignore-start */
import type { Context } from 'cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@huanlin/dsh-plugin-yet-another-subagent'

/** Cordis companion plugin name. */
export const name = 'yet-another-subagent-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: profile tools, the RPC interceptor, and the two
 * projections are registry-owned registrations whose disposal is proven by
 * the HMR-safety spec. They emit no cordis events and own no cross-plugin
 * mutable state (the in-memory ProfileStore's lifetime is the plugin fiber).
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
