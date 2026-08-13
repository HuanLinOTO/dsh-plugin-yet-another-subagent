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
import type { JsonValue } from '@deepseek-ai/dsh-session'
// Value import triggers `declare module '@deepseek-ai/cordis'` merge so `ctx.subagents`
// is typed. settleRun is reused by the foreground path.
import { settleRun } from '@deepseek-ai/dsh-subagent'
import type { SubagentProvider, SubagentResult, SubagentRun } from '@deepseek-ai/dsh-subagent'
import type { JobOutcome } from '@deepseek-ai/dsh-jobs'
import type { SubagentProfile } from './types.ts'
import { agentOptionsFor, personaForRequest, toolFilterForRequest } from './types.ts'

/** Merge-extensible session event: child started for a tool call. */
declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    'ya-subagent/started': { callId: string; childId: string; profileId: string }
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

/** Settle pending startup without rejecting the task producer contract. */
async function settleStart(start: Promise<SubagentRun>, signal: AbortSignal): Promise<JobOutcome> {
  try {
    return await settleRun(await start)
  } catch (error: unknown) {
    return signal.aborted
      ? { status: 'killed' }
      : { status: 'failed', detail: String(error) }
  }
}

type ForegroundToolResult = {
  readonly kind: 'foreground'
  readonly runId: SubagentRun['id']
  readonly output: JsonValue[]
}

/** Collect and release one foreground run without letting disposal replace an independent result failure. */
async function settleForegroundRun(run: SubagentRun): Promise<ForegroundToolResult> {
  const [execution] = await Promise.allSettled([
    run.result.then((result): ForegroundToolResult => {
      const error = stopReasonError(result)
      if (error !== undefined) throw new Error(error)
      return {
        kind: 'foreground',
        runId: run.id,
        output: result.output as unknown as JsonValue[],
      }
    }),
  ])
  const [disposal] = await Promise.allSettled([Promise.resolve().then(() => run.dispose())])
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
      const persona = personaForRequest(profile).persona
      const toolFilter = toolFilterForRequest(profile).toolFilter
      const request = {
        label: args.description,
        prompt: [{ type: 'text', text: args.prompt }] as ContentBlock[],
        parent,
        ...agentOptions !== undefined ? { agentOptions } : {},
        ...persona !== undefined ? { persona } : {},
        ...toolFilter !== undefined ? { toolFilter } : {},
        maxDepth: profile.maxDepth,
      }

      if (args.run_in_background === true) {
        if (profile.backgroundMode === 'one-shot') {
          // One-shot background: the child runs inside a Job; the caller
          // receives a job id and collects the result with `job_output`.
          // Mirrors the official tool-subagent one-shot background path.
          const jobs = ctx.get('jobs')
          if (jobs === undefined) {
            throw new Error('background jobs unavailable: load @deepseek-ai/dsh-jobs and @deepseek-ai/dsh-tool-jobs')
          }
          const id = jobs.start({
            kind: 'subagent',
            label: args.description,
            owner: parent,
            run: () => {
              const controller = new AbortController()
              const start = ctx.subagents.start('spawn', { ...request, signal: controller.signal })
              // Record the childId once the run starts so the client card
              // can navigate to the child session while the task is running.
              void start.then(run => {
                parent.session.append('ya-subagent/started', {
                  callId: exec.callId,
                  childId: String(run.id),
                  profileId: profile.id,
                })
              }).catch(() => {
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
        // `send_message`. Mirrors the official tool-subagent default shape
        // (base bundle sets backgroundMode: continuable).
        const spawn = ctx.subagents.getProvider('spawn')
        if (spawn === undefined) {
          throw new Error('subagent spawn provider not available; load @deepseek-ai/dsh-subagent-spawn-in-process')
        }
        if (spawn.prepareContinuable === undefined) {
          throw new Error('subagent spawn provider does not support continuable children')
        }

        const started = await ctx.subagents.startContinuable({
          provider: 'spawn',
          label: args.description,
          request,
          signal: exec.signal,
        })
        // Record the callId→childId mapping immediately so the client card
        // can navigate to the child session before the tool result lands.
        parent.session.append('ya-subagent/started', {
          callId: exec.callId,
          childId: started.childId,
          profileId: profile.id,
        })
        return {
          kind: 'continuable' as const,
          subagentId: started.childId,
          profileLabel: profile.label,
        }
      }

      // Default: foreground (one-shot). Collect the result and release the run.
      const run = await ctx.subagents.start('spawn', {
        ...request,
        signal: exec.signal,
      })
      // Record the callId→childId mapping immediately so the client card
      // can navigate to the child session while it is still running.
      parent.session.append('ya-subagent/started', {
        callId: exec.callId,
        childId: String(run.id),
        profileId: profile.id,
      })
      const result = await settleForegroundRun(run)
      return {
        kind: 'foreground' as const,
        runId: result.runId,
        profileLabel: profile.label,
        output: result.output,
      }
    },
  })
}

// Re-exports for the index module.
export { settleStart }
export type { SubagentProvider, SubagentResult, SubagentRun, JobOutcome }
