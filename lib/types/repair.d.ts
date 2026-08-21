/**
 * One-shot session-log repair: stamp `"ignorable": true` onto legacy
 * `ya-subagent/started` events so the harness persistence read path
 * (`assertEventsSupported`) will skip them instead of refusing the whole log.
 *
 * Background: older plugin versions wrote `ya-subagent/started` via
 * `session.append(...)`, but `session.append` cannot set the `ignorable`
 * envelope flag, and `KNOWN_SESSION_EVENT_TYPES` is code-generated with no
 * plugin registration surface. The read path therefore refuses any log
 * containing the type unless each occurrence carries `ignorable: true`.
 * This module rewrites on-disk artifacts in place (after a `.bak` backup) to
 * add that flag to every `ya-subagent/started` row missing it.
 *
 * Two physical encodings (mirrors `session-persistence-jsonl`):
 *   - `.jsonl`        — plaintext, one JSON record per line.
 *   - `.jsonl.zstd`   — concatenated independent Zstandard frames: the first
 *                       frame holds the session header line, subsequent
 *                       frames each hold one append batch of event lines.
 *                       Each frame is independently decodable + checksummed.
 *                       Only frames whose decoded plaintext contains a target
 *                       row are recompressed; untouched frames are copied
 *                       verbatim so byte-identity is preserved where possible.
 *
 * Idempotent: rows already carrying `ignorable: true` are skipped; files with
 * no target rows are left untouched (no backup, no rewrite).
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/repair
 */
/** Aggregate result of one repair run. */
export interface RepairStats {
    /** Session log files examined (`.jsonl` + `.jsonl.zstd`). */
    readonly scanned: number;
    /** Files rewritten because at least one target row was patched. */
    readonly repaired: number;
    /** Files with no patchable rows (already clean or no target events). */
    readonly skipped: number;
    /** Per-file errors (path + message); empty on a clean run. */
    readonly errors: readonly {
        readonly path: string;
        readonly message: string;
    }[];
}
/**
 * Recursively repair every session log under `sessionsRoot`.
 *
 * @param sessionsRoot - absolute path to `$DSH_HOME/sessions`.
 * @returns aggregate stats. Never throws — per-file failures land in `errors`.
 */
export declare function repairSessions(sessionsRoot: string): Promise<RepairStats>;
