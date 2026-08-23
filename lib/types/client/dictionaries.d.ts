/**
 * dictionaries.ts — the 19 better-locale override languages for the
 * yet-another-subagent copy, keyed by language id. Each dictionary carries
 * the same key set as `en`/`zh` in `./locales.ts` (enforced by the
 * `Record<YaSubagentKey, string>` annotation); values keep `{placeholder}`
 * interpolation, matching the better-locale store's `LocaleDict` contract.
 *
 * The apply function registers these into `ctx.betterLocale` (the override
 * store) under `NS`, so when the user selects an override language through
 * dsh-plugin-better-locale (and DSH is on 'en', whose slot the override
 * borrows), the plugin UI renders in the override language.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/client/dictionaries
 */
import type { YaSubagentKey } from './locales.ts';
/** All override-language dictionaries for the `ya-subagent` namespace. */
export declare const dicts: Record<string, Record<YaSubagentKey, string>>;
