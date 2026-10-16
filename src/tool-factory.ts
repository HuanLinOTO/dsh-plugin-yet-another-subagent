/**
 * Tool factory: compile the profile list into a single `defineTool` definition.
 *
 * One `subagent` tool is exposed to the model regardless of how many profiles
 * are configured. The desired profile is selected via the `profile` parameter
 * (an enum of available profile ids). This keeps the tool surface flat — the
 * model learns one tool, not N — and profile add/remove does not change the
 * tool name set the model was trained against.
 *
 * Two profile-specific extensions are preserved from the per-profile design:
 *   1. The continuable result content embeds `profileLabel` so SubagentCard
 *      can render with zero RPC (SkillRow paradigm, design doc §4.4).
 *   2. The `profile` parameter enum lists the live profile ids.
 *
 * Foreground (one-shot) path is kept for `run_in_background: false`; the
 * default is continuable background.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/tool-factory
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { AgentOptions } from '@deepseek-ai/dsh-agent'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
// Type imports resolve the package's `declare module 'cordis'` merge so
// `ctx.subagents` is typed (src/index.ts's value import loads the module).
import type { SubagentActivation, SubagentResult } from '@deepseek-ai/dsh-subagent'
import type { JobOutcome } from '@deepseek-ai/dsh-jobs'
import type { SubagentProfile } from './types.ts'
import { agentOptionsFor } from './types.ts'

/** Merge-extensible session event: child started for a tool call. */
declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    'ya-subagent/started': { callId: string; childId: string; profileId: string }
  }
}

// dsh 0.2.1-alpha.5 removed the central `subagent` member from `JobKindMap`
// (the official one-shot background path is gone); a plugin-owned job kind is
// registered by declaration merging, matching tool-pwsh / tool-workflow.
declare module '@deepseek-ai/dsh-jobs' {
  interface JobKindMap {
    subagent: 'subagent'
  }
}

/** Render text blocks from the canonical JSON block array. */
function outputValueText(values: JsonValue[]): string {
  return values
    .filter((value): value is { type: 'text'; text: string } =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
      && value.type === 'text' && typeof value.text === 'string')
    .map(value => value.text)
    .join('')
}

/** A non-`completed` stop reason means the child did not finish cleanly. */
function stopReasonError(result: SubagentResult): string | undefined {
  switch (result.stopReason) {
    case 'completed':
      return undefined
    case 'aborted':
      return 'subagent run was cancelled'
    case 'error':
      return 'subagent run failed'
    case 'max-tokens':
      return 'subagent run hit its token limit before finishing'
    case 'refusal':
      return 'subagent declined the task'
    // Merge-extensible union: a backend may add stop reasons. Treat an unknown
    // terminal reason as a failure rather than reporting partial output as success.
    default:
      return `subagent run ended abnormally (${String(result.stopReason)})`
  }
}

/** Flatten a child's final output blocks to text (the job result face). */
function finalText(blocks: readonly ContentBlock[]): string {
  return blocks
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('')
}

/** Render a failed stop reason with optional provider-authored detail. */
function failureDetail(result: SubagentResult): string {
  const stopReason = result.stopReason
  return result.diagnostic === undefined
    ? stopReason
    : `${stopReason}; diagnostic: ${result.diagnostic}`
}

/**
 * Map a child result to the background-job outcome: completed carries final
 * text, local cancellation (`aborted` without a diagnostic) is killed, and
 * provider-diagnosed remote aborts plus every other reason are failed without
 * partial output. Mirrors the rc.2 `settleRun` mapping that 0.2.1-alpha.5
 * removed from `@deepseek-ai/dsh-subagent` (DSH-0.2.1-J1-05).
 */
function activationOutcome(result: SubagentResult): JobOutcome {
  switch (result.stopReason) {
    case 'completed':
      return { status: 'completed', result: finalText(result.output) }
    case 'aborted':
      return result.diagnostic === undefined
        ? { status: 'killed' }
        : { status: 'failed', detail: failureDetail(result) }
    case 'error':
    case 'max-tokens':
    case 'refusal':
      return { status: 'failed', detail: failureDetail(result) }
    // Merge-extensible reasons remain failures with provider-authored detail.
    default:
      return { status: 'failed', detail: failureDetail(result) }
  }
}

/**
 * Await the activation result, dispose it, then return the job outcome.
 * Result and disposal failures become `failed`; when both fail, both details
 * survive. Caller-delivery activations settle through `result` and release
 * through `dispose()` (DSH-0.2.1-J1-05).
 */
async function settleActivation(activation: SubagentActivation): Promise<JobOutcome> {
  let outcome: JobOutcome
  try {
    outcome = activationOutcome(await activation.result)
  } catch (error: unknown) {
    outcome = { status: 'failed', detail: String(error) }
  }
  try {
    await activation.dispose()
  } catch (error: unknown) {
    const prefix = outcome.detail === undefined ? '' : `${outcome.detail}; `
    return { status: 'failed', detail: `${prefix}dispose failed: ${String(error)}` }
  }
  return outcome
}

/** Settle pending startup without rejecting the task producer contract. */
async function settleStart(start: Promise<SubagentActivation>, signal: AbortSignal): Promise<JobOutcome> {
  try {
    return await settleActivation(await start)
  } catch (error: unknown) {
    return signal.aborted
      ? { status: 'killed' }
      : { status: 'failed', detail: String(error) }
  }
}

type ForegroundToolResult = {
  readonly kind: 'foreground'
  readonly runId: SubagentActivation['childId']
  readonly output: JsonValue[]
}

/** Collect and release one caller-delivery activation without letting disposal replace an independent result failure. */
async function settleForegroundRun(activation: SubagentActivation): Promise<ForegroundToolResult> {
  const [execution] = await Promise.allSettled([
    activation.result.then((result): ForegroundToolResult => {
      const error = stopReasonError(result)
      if (error !== undefined) throw new Error(error)
      return {
        kind: 'foreground',
        runId: activation.childId,
        output: result.output as unknown as JsonValue[],
      }
    }),
  ])
  const [disposal] = await Promise.allSettled([Promise.resolve().then(() => activation.dispose())])
  if (execution.status === 'rejected') {
    if (disposal.status === 'rejected') {
      throw new AggregateError(
        [execution.reason, disposal.reason],
        `subagent run failed: ${String(execution.reason)}; dispose failed: ${String(disposal.reason)}`,
      )
    }
    throw execution.reason
  }
  if (disposal.status === 'rejected') throw disposal.reason
  return execution.value
}

/**
 * Build the model-facing tool description. Uses the official `tool-subagent`
 * non-inheriting wording (spawn provider: the child does not see this
 * conversation), then lists the available profiles and appends the
 * background-mode suffix.
 *
 * When all profiles share the same `backgroundMode`, the exact original
 * suffix wording is used. When profiles mix modes, a combined suffix covers
 * both paths.
 */
function buildDescription(profiles: readonly SubagentProfile[]): string {
  const lines = profiles.map(p => `  - "${p.id}": ${p.label}`)
  const hasContinuable = profiles.some(p => p.backgroundMode === 'continuable')
  const hasOneShot = profiles.some(p => p.backgroundMode === 'one-shot')

  const base =
    'Delegate a self-contained task to a subagent (a separate agent that works in its own context) '
    + 'and return its final result. Use this to offload focused, independent work — research, a scoped '
    + 'implementation, an analysis — so it does not consume this conversation\'s context. The subagent '
    + 'runs to completion and you receive only its final answer, not its intermediate steps. Give it a '
    + 'complete, standalone prompt: it does not see this conversation.'

  const profileList = 'Pick a profile that matches the task nature. Available profiles:\n' + lines.join('\n')

  let bgSuffix: string
  if (hasContinuable && hasOneShot) {
    bgSuffix =
      ' Set `run_in_background: true` to start a background subagent. In continuable mode, it keeps its'
      + ' conversation and you receive only its subagent id (send more work with `send_message`). In'
      + ' one-shot mode, you receive a job id (collect with `job_output`, stop with `job_kill`).'
      + ' The mode depends on the selected profile.'
  } else if (hasOneShot) {
    bgSuffix = ' Set `run_in_background: true` to return a job id; collect with `job_output` and stop with `job_kill`.'
  } else {
    bgSuffix =
      ' Set `run_in_background: true` to start a background subagent that keeps its conversation:'
      + ' you receive only its subagent id, never its result, and it works on its own. Use this for'
      + ' work whose result you do not need returned by this call; `send_message` sends it more work.'
  }

  return base + '\n' + profileList + bgSuffix
}

/** Build the `run_in_background` parameter description from the profiles' modes. */
function buildRunInBackgroundDescription(profiles: readonly SubagentProfile[]): string {
  const hasContinuable = profiles.some(p => p.backgroundMode === 'continuable')
  const hasOneShot = profiles.some(p => p.backgroundMode === 'one-shot')
  if (hasContinuable && hasOneShot) {
    return 'Run as a background subagent. In continuable mode, it keeps its conversation and you receive'
      + ' only its subagent id (send more work with send_message). In one-shot mode, you receive a job'
      + ' id (collect with job_output, stop with job_kill). The mode depends on the selected profile.'
  }
  if (hasOneShot) {
    return 'Run as a background job and return its id; collect with job_output or stop with job_kill.'
  }
  return 'Run as a background subagent that keeps its conversation and return only its subagent id.'
    + ' This call never returns its result; send it more work with send_message.'
}

/** Arguments expected by the single `subagent` tool. */
interface SubagentToolArgs {
  readonly profile?: string
  readonly description: string
  readonly prompt: string
  readonly run_in_background?: boolean
}

/**
 * Build the single model-facing `subagent` tool definition.
 *
 * @param profiles - the live profile list (drives the `profile` enum).
 * @param ctx - host context carrying `subagents` (and `jobs` for one-shot background).
 * @returns a `defineTool` definition ready for `ctx.tools.register`.
 */
export function buildTool(profiles: readonly SubagentProfile[], ctx: Context) {
  const profileIds = profiles.map(p => p.id)
  return defineTool({
    name: 'subagent',
    description: buildDescription(profiles),
    parameters: {
      profile: {
        type: 'string',
        description: 'Which subagent profile to use. Omit to use the default "general" profile.',
        enum: profileIds,
      },
      description: {
        type: 'string',
        required: true,
        description: 'A short (3-5 word) description of the delegated task, for display.',
      },
      prompt: {
        type: 'string',
        required: true,
        description: 'The complete, self-contained task for the subagent. It does not share this conversation\'s context, so include everything it needs.',
      },
      run_in_background: {
        type: 'boolean',
        description: buildRunInBackgroundDescription(profiles),
      },
    },
    output: {
      schema: {
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', required: true, const: 'background' },
              taskId: { type: 'string', required: true },
              profileLabel: { type: 'string', required: true },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', required: true, const: 'continuable' },
              subagentId: { type: 'string', required: true },
              profileLabel: { type: 'string', required: true },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', required: true, const: 'foreground' },
              runId: { type: 'string', required: true },
              profileLabel: { type: 'string', required: true },
              output: { type: 'array', required: true, items: { type: 'json' } },
            },
          },
        ],
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.kind === 'background'
          ? `started background subagent task ${value.taskId}`
          : value.kind === 'continuable'
            ? `started ${value.profileLabel} subagent ${value.subagentId}`
            : `completed ${value.profileLabel} subagent ${value.runId}\n${outputValueText(value.output)}`,
      }],
    },
    async execute(args: SubagentToolArgs, exec) {
      const profileId = args.profile ?? 'general'
      const profile = profiles.find(p => p.id === profileId)
      if (profile === undefined) {
        throw new Error(`subagent: unknown profile "${args.profile}". Available: ${profileIds.join(', ')}`)
      }

      const parent = exec.agent
      if (!parent) {
        throw new Error('subagent tool requires a calling agent (exec.agent was undefined)')
      }

      const agentOptions: AgentOptions | undefined = agentOptionsFor(profile).agentOptions
      // 0.2.1-alpha.5: `label` moved to the activation spec level and the
      // request lost `persona`/`toolFilter` (DSH-0.2.1-J1-05). Personas come
      // from agent presets; tool filters no longer exist.
      const request = {
        prompt: [{ type: 'text', text: args.prompt }] as ContentBlock[],
        parent,
        ...agentOptions !== undefined ? { agentOptions } : {},
        maxDepth: profile.maxDepth,
      }

      if (args.run_in_background === true) {
        if (profile.backgroundMode === 'one-shot') {
          // One-shot background: the child runs inside a Job as a
          // caller-delivery activation; the caller receives a job id and
          // collects the result with `job_output`. Mirrors the rc.2
          // official one-shot background path on the new start API.
          const jobs = ctx.get('jobs')
          if (jobs === undefined) {
            throw new Error('background jobs unavailable: load @deepseek-ai/dsh-jobs and @deepseek-ai/dsh-tool-jobs')
          }
          const id = jobs.start({
            kind: 'subagent',
            label: args.description,
            // `JobSpec.owner` is a durable SessionId, not the Agent.
            owner: parent.id,
            run: () => {
              const controller = new AbortController()
              const start = ctx.subagents.startActivation({
                provider: 'spawn',
                label: args.description,
                request,
                signal: controller.signal,
                delivery: 'caller',
              })
              // NOTE: previously appended a `ya-subagent/started` event here to
              // surface the childId early. Removed: harness persistence refuses
              // to load logs containing unknown event types unless marked
              // ignorable, and `session.append` has no way to set that flag.
              // The continuable/foreground branches embed the childId in the
              // result text, so only the background one-shot card loses early
              // childId resolution (degrades to "completed" display; the job
              // itself runs unchanged — job_output/job_kill keep working).
              void start.catch(() => {
                // Startup failure: settleStart will report the task as failed.
              })
              return {
                cancel: (reason?: string) => {
                  controller.abort(reason ?? 'background subagent task killed')
                },
                done: settleStart(start, controller.signal),
                // No readOutput: the child session owns intermediate detail.
              }
            },
          })
          return {
            kind: 'background' as const,
            taskId: String(id),
            profileLabel: profile.label,
          }
        }

        // Continuable background: the child keeps its conversation; the
        // caller receives only its subagent id and sends more work via
        // `send_message` (parent delivery notifies the model on completion —
        // the official default). Fail loud when the spawn backend cannot host
        // a local continuable child instead of silently degrading to an
        // external one-shot execution.
        const spawn = ctx.subagents.getProvider('spawn')
        if (spawn === undefined) {
          throw new Error('subagent spawn provider not available; load @deepseek-ai/dsh-subagent-spawn-in-process')
        }
        if (spawn.prepareContinuable === undefined) {
          throw new Error('subagent spawn provider does not support continuable children')
        }

        const started = await ctx.subagents.startActivation({
          provider: 'spawn',
          label: args.description,
          request,
          signal: exec.signal,
          delivery: 'parent',
        })
        // childId is embedded in the result text below; SubagentCard parses it
        // directly (no projection event needed).
        return {
          kind: 'continuable' as const,
          subagentId: started.childId,
          profileLabel: profile.label,
        }
      }

      // Default: foreground (one-shot). Collect the caller-delivery result
      // and release the activation.
      const activation = await ctx.subagents.startActivation({
        provider: 'spawn',
        label: args.description,
        request,
        signal: exec.signal,
        delivery: 'caller',
      })
      // childId (runId) is embedded in the result text below; SubagentCard
      // parses it directly (no projection event needed).
      const result = await settleForegroundRun(activation)
      return {
        kind: 'foreground' as const,
        runId: result.runId,
        profileLabel: profile.label,
        output: result.output,
      }
    },
  })
}
