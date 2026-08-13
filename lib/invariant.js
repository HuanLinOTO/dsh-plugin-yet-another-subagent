//#region src/invariant.ts
const PACKAGE_NAME = "@huanlin/dsh-plugin-yet-another-subagent";
/** Cordis companion plugin name. */
const name = "yet-another-subagent-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/**
* No runtime invariant: profile tools, the RPC interceptor, and the two
* projections are registry-owned registrations whose disposal is proven by
* the HMR-safety spec. They emit no cordis events and own no cross-plugin
* mutable state (the in-memory ProfileStore's lifetime is the plugin fiber).
*/
const install = () => {};
/**
* Register this package's invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns the installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
