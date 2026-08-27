/**
 * One-shot session-log repair: physically REMOVE legacy `ya-subagent/started`
 * event rows so the harness persistence read path (`assertEventsSupported`)
 * loads the log again.
 *
 * Background: plugin versions ≤0.1.2 appended `ya-subagent/started` via
 * `session.append(...)`. `KNOWN_SESSION_EVENT_TYPES` is code-generated with no
 * plugin registration surface, and v0.1.2-alpha.1 refuses EVERY log row whose
 * type is outside that set — the old `ignorable` envelope flag no longer
 * exists, so stamping it (the ≤0.1.5 repair) cannot help. The only repair is
 * removal.
 *
 * Rows cannot simply be deleted: the read path enforces contiguous `seq`
 * numbers. This module therefore rewrites the log in place (after a `.bak`
 * backup):
 *
 *   - drops every `ya-subagent/started` row;
 *   - decrements the `seq` of every later ordinary event row (packed
 *     `text-chunks` / `reasoning-chunks` / `tool-call-chunks` storage rows
 *     shift their `seq0` instead);
 *   - shifts every `sourceEventSeqs` citation by the number of dropped rows
 *     ahead of it (dropped rows are never cited: only surface events carry
 *     provenance and they cite assistant chunks / surface nodes, which a
 *     plugin row never is).
 *
 * Two physical encodings (mirrors `session-persistence-jsonl`):
 *   - `.jsonl`        — plaintext, one JSON record per line.
 *   - `.jsonl.zstd`   — concatenated independent Zstandard frames: the first
 *                       frame holds the session header line, subsequent
 *                       frames each hold one append batch of event lines.
 *                       Each frame is independently decodable + checksummed.
 *                       The first frame containing a dropped row and every
 *                       frame after it are recompressed (their rows renumber);
 *                       untouched earlier frames are copied verbatim.
 *
 * Modified rows are re-encoded with `JSON.stringify`, which reproduces the
 * write path's canonical single-line form and preserves the parsed key order;
 * untouched lines stay byte-identical.
 *
 * Idempotent: a log with no target rows is left untouched (no backup, no
 * rewrite). A corrupt (unparsable) line is left untouched — that is the
 * harness's refusal job, not ours.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/repair
 */
/** Aggregate result of one repair run. */
export interface RepairStats {
    /** Session log files examined (`.jsonl` + `.jsonl.zstd`). */
    readonly scanned: number;
    /** Files rewritten because at least one target row was removed. */
    readonly repaired: number;
    /** Files with no target rows (already clean). */
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
