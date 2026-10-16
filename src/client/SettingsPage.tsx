/**
 * SettingsPage — the `ya-subagent` settings section: profile list CRUD.
 *
 * Visual language: matches ModelsSection / GeneralSection — outlined rowCard
 * per profile (border-l2, r12, p12/14), filled editor surface
 * (bg-module-platform, r12, p14/16), capsule controls (h36 r18 primary,
 * h28 r14 secondary), 32px fields with border-l2 / bg-layer-1, 12/18 caption
 * labels. Every color resolves through --dsw-alias-* tokens.
 *
 * Each profile card is collapsible (chevron in the row head); the editor
 * surface is hidden when collapsed. Builtin profiles (cordis.yml seed) carry
 * a `builtin`/`内置` badge next to the title. The "+ Add subagent" button at
 * the bottom reveals an inline draft card with all fields editable (including
 * id) and Create / Cancel actions.
 *
 * Persona and tool-filter editing were removed with dsh 0.2.1-alpha.5
 * (DSH-0.2.1-J1-05): the subagent start request no longer carries `persona`
 * (agent presets own it) or `toolFilter` (removed).
 *
 * Pulls the profile list once on mount via `connection.rpc.call('/api',
 * 'ya-subagent.profiles.list')`, dispatches add/update/remove through the
 * same RPC. The toolview slot is keyed by `subagent` and registered once at
 * plugin load, so profile mutations do not need to re-register slots.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/client/SettingsPage
 */

import { useCallback, useEffect, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ClientConnectionRpc, RpcResult } from '@deepseek-ai/dsh-client-connection/client'
// Type-only: pulls the 'plugins.row.config' SlotMap row (the Plugins page owner).
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { IconChevronDownOutlineMedium, Menu, Modal, Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SubagentProfile } from '../types.ts'
import type { ProfileListResponse } from '../rpc.ts'
import css from './SettingsPage.module.css'

/** Wire shape of `sessions.repair` (mirrors `RepairStats` on the host). */
interface RepairStats {
  readonly scanned: number
  readonly repaired: number
  readonly skipped: number
  readonly errors: readonly { readonly path: string; readonly message: string }[]
}
type RepairResult = RpcResult<RepairStats>

/** Inject face: RPC handle + locale translate. */
export interface YaSubagentSettingsInjected {
  readonly rpc: ClientConnectionRpc
  /** Refetch the profile list from the host. */
  readonly fetchProfiles: () => Promise<readonly SubagentProfile[]>
  /** Refetch the routable model catalog (provider groups); undefined on failure. */
  readonly fetchModelCatalog: () => Promise<ModelCatalogData | undefined>
  /** Bound locale translator for the ya-subagent namespace. */
  readonly t: (key: string) => string
}

/** Full props: plugins.row.config runtime share + locale seat + inject. */
type SettingsPageProps = PropsRuntime<'plugins.row.config'> & PropsLocale<'ya-subagent'> & YaSubagentSettingsInjected

type ProfileListResult = RpcResult<ProfileListResponse>

/** One model inside a provider group (mirrors `ModelCatalogModel`). */
interface ModelEntry {
  readonly id: string
  readonly name: string
  readonly description?: string
}

/** One provider group (mirrors `ModelProviderGroup`). */
interface ModelGroup {
  readonly id: string
  readonly name: string
  readonly models: readonly ModelEntry[]
}

/** Model catalog wire shape (mirror of the host `ModelCatalog` read face). */
interface ModelCatalogData {
  readonly groups: readonly ModelGroup[]
}

/** Default shape for a brand-new draft (before the user fills in id/label). */
function emptyDraft(): SubagentProfile {
  return {
    id: '',
    label: '',
    model: { kind: 'auto', provider: '', model: '' },
    maxDepth: 3,
    backgroundMode: 'continuable',
    builtin: false,
  }
}

async function callRpc<T>(
  rpc: ClientConnectionRpc,
  endpoint: string,
  payload: unknown,
): Promise<T> {
  // Endpoints live on the shared `/api` channel as exact Fetch routes
  // (`/api/ya-subagent.<endpoint>`), registered by the host half.
  return rpc.call('/api', `ya-subagent.${endpoint}`, payload) as Promise<T>
}

/**
 * Render the subagent profiles settings page.
 * @param props - plugins.row.config runtime share + locale + inject.
 * @returns the page element (summary one-liner for `view: 'summary'`).
 */
export function SettingsPage({ view, rpc, fetchProfiles, fetchModelCatalog, t }: SettingsPageProps) {
  const [profiles, setProfiles] = useState<readonly SubagentProfile[]>([])
  const [drafts, setDrafts] = useState<readonly SubagentProfile[]>([])
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [addingNew, setAddingNew] = useState(false)
  const [newDraft, setNewDraft] = useState<SubagentProfile>(emptyDraft())
  const [modelGroups, setModelGroups] = useState<readonly ModelGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)
  const [confirmDelete, setConfirmDelete] = useState<string | undefined>(undefined)
  const [repairConfirmOpen, setRepairConfirmOpen] = useState(false)
  const [repairRunning, setRepairRunning] = useState(false)
  const [repairStats, setRepairStats] = useState<RepairStats | undefined>(undefined)
  const [repairError, setRepairError] = useState<string | undefined>(undefined)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const [list, catalog] = await Promise.all([
        fetchProfiles(),
        fetchModelCatalog().catch(() => undefined),
      ])
      setProfiles(list)
      setDrafts(list.map(p => ({ ...p })))
      if (catalog !== undefined) setModelGroups(catalog.groups)
      else setModelGroups([])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [fetchProfiles, fetchModelCatalog])

  useEffect(() => { void refresh() }, [refresh])

  const addProfile = useCallback(async () => {
    if (newDraft.id === '' || newDraft.label === '') return
    const result = await callRpc<ProfileListResult>(rpc, 'profiles.add', { profile: newDraft })
    if (result.ok) {
      setProfiles(result.value.profiles)
      setDrafts(result.value.profiles.map(p => ({ ...p })))
      // Expand the newly created card so the user can keep editing if needed.
      setExpanded(new Set([...expanded, newDraft.id]))
      setAddingNew(false)
      setNewDraft(emptyDraft())
    } else {
      setError(result.error.message)
    }
  }, [expanded, newDraft, rpc])

  const updateProfile = useCallback(async (draft: SubagentProfile) => {
    const result = await callRpc<ProfileListResult>(rpc, 'profiles.update', { profile: draft })
    if (result.ok) {
      setProfiles(result.value.profiles)
      setDrafts(result.value.profiles.map(p => ({ ...p })))
    } else {
      setError(result.error.message)
    }
  }, [rpc])

  const removeProfile = useCallback(async (id: string) => {
    const result = await callRpc<ProfileListResult>(rpc, 'profiles.remove', { id })
    if (result.ok) {
      setProfiles(result.value.profiles)
      setDrafts(result.value.profiles.map(p => ({ ...p })))
      const next = new Set(expanded)
      next.delete(id)
      setExpanded(next)
    } else {
      setError(result.error.message)
    }
  }, [expanded, rpc])

  const runRepair = useCallback(async () => {
    setRepairConfirmOpen(false)
    setRepairRunning(true)
    setRepairError(undefined)
    try {
      const result = await callRpc<RepairResult>(rpc, 'sessions.repair', {})
      if (result.ok) {
        setRepairStats(result.value)
      } else {
        setRepairError(result.error.message)
      }
    } catch (err) {
      setRepairError(err instanceof Error ? err.message : String(err))
    } finally {
      setRepairRunning(false)
    }
  }, [rpc])

  const patchDraft = (id: string, patch: Partial<SubagentProfile>): void => {
    setDrafts(prev => prev.map(d => (d.id === id ? { ...d, ...patch } : d)))
  }

  const toggleExpand = (id: string): void => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  const cancelNew = (): void => {
    setAddingNew(false)
    setNewDraft(emptyDraft())
  }

  // The Plugins page asks a row for a one-liner when it has no description.
  if (view === 'summary') return <p className={css.empty}>{t('page.title')}</p>

  return (
    <section className={css.section}>
      <h2 className={css.title}>{t('page.title')}</h2>
      {error !== undefined && (
        <div className={css.error}>
          {error}
          <button type="button" className={css.errorDismiss} onClick={() => setError(undefined)}>×</button>
        </div>
      )}
      {loading ? (
        <div className={css.loading}>…</div>
      ) : profiles.length === 0 && !addingNew ? (
        <p className={css.empty}>{t('page.empty')}</p>
      ) : (
        <ul className={css.rows}>
          {drafts.map(draft => (
            <ProfileCard
              key={draft.id}
              draft={draft}
              expanded={expanded.has(draft.id)}
              modelGroups={modelGroups}
              t={t}
              onToggle={() => toggleExpand(draft.id)}
              onPatch={patch => patchDraft(draft.id, patch)}
              onSave={() => void updateProfile(draft)}
              onDelete={() => setConfirmDelete(draft.id)}
            />
          ))}
          {addingNew && (
            <ProfileCard
              key="__new__"
              draft={newDraft}
              expanded={true}
              isNew={true}
              modelGroups={modelGroups}
              t={t}
              onPatch={patch => setNewDraft(prev => ({ ...prev, ...patch }))}
              onCreate={() => void addProfile()}
              onCancel={cancelNew}
            />
          )}
        </ul>
      )}
      {!loading && !addingNew && (
        <button type="button" className={css.addBlockButton} onClick={() => setAddingNew(true)}>
          {t('page.add')}
        </button>
      )}
      <div className={css.repairBlock}>
        <button
          type="button"
          className={css.secondaryButton}
          disabled={repairRunning}
          onClick={() => setRepairConfirmOpen(true)}
        >
          {repairRunning ? t('repair.running') : t('repair.button')}
        </button>
      </div>
      <Modal
        open={repairConfirmOpen}
        onClose={() => { setRepairConfirmOpen(false) }}
        title={t('repair.confirm.title')}
        closeLabel={t('common.close')}
        footer={(
          <>
            <button type="button" className={css.secondaryButton} onClick={() => { setRepairConfirmOpen(false) }}>
              {t('repair.confirm.cancel')}
            </button>
            <button
              type="button"
              className={css.primaryButton}
              onClick={() => { void runRepair() }}
            >
              {t('repair.confirm.proceed')}
            </button>
          </>
        )}
      >
        <p className={css.confirmText}>{t('repair.confirm.body')}</p>
        <p className={css.confirmText}>{t('repair.confirm.warning')}</p>
      </Modal>
      <Modal
        open={repairStats !== undefined || repairError !== undefined}
        onClose={() => { setRepairStats(undefined); setRepairError(undefined) }}
        title={t('repair.result.title')}
        closeLabel={t('common.close')}
        footer={(
          <button
            type="button"
            className={css.secondaryButton}
            onClick={() => { setRepairStats(undefined); setRepairError(undefined) }}
          >
            {t('repair.result.close')}
          </button>
        )}
      >
        {repairError !== undefined ? (
          <p className={css.error}>{t('repair.error')}: {repairError}</p>
        ) : repairStats !== undefined ? (
          <div className={css.repairStats}>
            <p className={css.confirmText}>{t('repair.result.scanned').replace('{n}', String(repairStats.scanned))}</p>
            <p className={css.confirmText}>{t('repair.result.repaired').replace('{n}', String(repairStats.repaired))}</p>
            <p className={css.confirmText}>{t('repair.result.skipped').replace('{n}', String(repairStats.skipped))}</p>
            <p className={css.confirmText}>{t('repair.result.errors').replace('{n}', String(repairStats.errors.length))}</p>
            {repairStats.errors.length > 0 && (
              <ul className={css.repairErrorList}>
                {repairStats.errors.map((e, i) => (
                  <li key={i} className={css.confirmText}>
                    {t('repair.result.errorEntry').replace('{path}', e.path).replace('{message}', e.message)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </Modal>
      <Modal
        open={confirmDelete !== undefined}
        onClose={() => { setConfirmDelete(undefined) }}
        title={t('row.delete.confirm')}
        closeLabel={t('common.close')}
        footer={(
          <>
            <button type="button" className={css.secondaryButton} onClick={() => { setConfirmDelete(undefined) }}>
              {t('page.add.cancel')}
            </button>
            <button
              type="button"
              className={css.dangerButton}
              onClick={() => {
                if (confirmDelete !== undefined) void removeProfile(confirmDelete)
                setConfirmDelete(undefined)
              }}
            >
              {t('row.delete')}
            </button>
          </>
        )}
      >
        <p className={css.confirmText}>{t('row.delete.confirm')}</p>
      </Modal>
    </section>
  )
}

// ─── ProfileCard ─────────────────────────────────────────────────────────────

interface ProfileCardProps {
  readonly draft: SubagentProfile
  readonly expanded: boolean
  readonly isNew?: boolean
  readonly modelGroups: readonly ModelGroup[]
  readonly t: (key: string) => string
  readonly onToggle?: () => void
  readonly onPatch: (patch: Partial<SubagentProfile>) => void
  readonly onSave?: () => void
  readonly onDelete?: () => void
  readonly onCreate?: () => void
  readonly onCancel?: () => void
}

function ProfileCard({ draft, expanded, isNew, modelGroups, t, onToggle, onPatch, onSave, onDelete, onCreate, onCancel }: ProfileCardProps) {
  return (
    <li className={css.rowCard}>
      <div className={css.rowHead}>
        {!isNew && onToggle !== undefined && (
          <button type="button" className={css.chevronButton} onClick={onToggle} aria-label={expanded ? t('row.collapse') : t('row.expand')}>
            <span className={expanded ? `${css.chevron} ${css.chevronExpanded}` : css.chevron} aria-hidden="true" />
          </button>
        )}
        {isNew && <span className={css.chevronSpacer} aria-hidden="true" />}
        <div className={css.rowIdentity}>
          {isNew ? (
            <span className={css.rowNamePlaceholder}>{t('page.add')}</span>
          ) : (
            <span className={css.rowName}>{draft.label === '' ? draft.id : draft.label}</span>
          )}
          {draft.builtin && <Pill className={css.builtinBadge}>{t('badge.builtin')}</Pill>}
          {!isNew && <code className={css.rowId}>{draft.id}</code>}
        </div>
        <div className={css.rowActions}>
          {isNew ? (
            <>
              <button type="button" className={css.primaryButton} onClick={onCreate} disabled={draft.id === '' || draft.label === ''}>
                {t('page.add.submit')}
              </button>
              <button type="button" className={css.secondaryButton} onClick={onCancel}>
                {t('page.add.cancel')}
              </button>
            </>
          ) : (
            <>
              <button type="button" className={css.secondaryButton} onClick={onSave}>
                {t('row.save')}
              </button>
              <button type="button" className={css.dangerButton} onClick={onDelete}>
                {t('row.delete')}
              </button>
            </>
          )}
        </div>
      </div>
      {expanded && (
        <div className={css.editor}>
          {isNew && (
            <>
              <label className={css.field}>
                <span className={css.fieldLabel}>{t('row.id')}</span>
                <input
                  className={css.input}
                  value={draft.id}
                  placeholder={t('page.add.placeholder.id')}
                  onChange={e => onPatch({ id: e.target.value })}
                />
              </label>
              <label className={css.field}>
                <span className={css.fieldLabel}>{t('row.label')}</span>
                <input
                  className={css.input}
                  value={draft.label}
                  placeholder={t('page.add.placeholder.label')}
                  onChange={e => onPatch({ label: e.target.value })}
                />
              </label>
            </>
          )}
          {!isNew && (
            <label className={css.field}>
              <span className={css.fieldLabel}>{t('row.label')}</span>
              <input
                className={css.input}
                value={draft.label}
                onChange={e => onPatch({ label: e.target.value })}
              />
            </label>
          )}
          <div className={css.field}>
            <span className={css.fieldLabel}>{t('row.model.kind.auto')} / {t('row.model.kind.manual')}</span>
            <div className={css.radioGroup}>
              <label className={css.radioOption}>
                <input
                  type="radio"
                  name={`model-${draft.id}-${isNew ? 'new' : ''}`}
                  checked={draft.model.kind === 'auto'}
                  onChange={() => onPatch({ model: { kind: 'auto', provider: '', model: '' } })}
                />
                {t('row.model.kind.auto')}
              </label>
              <label className={css.radioOption}>
                <input
                  type="radio"
                  name={`model-${draft.id}-${isNew ? 'new' : ''}`}
                  checked={draft.model.kind === 'manual'}
                  onChange={() => onPatch({ model: { kind: 'manual', provider: draft.model.provider, model: draft.model.model } })}
                />
                {t('row.model.kind.manual')}
              </label>
            </div>
          </div>
          {draft.model.kind === 'manual' && (
            <>
              <div className={css.field}>
                <span className={css.fieldLabel}>{t('row.model.provider')}</span>
                <DropdownPicker
                  value={draft.model.provider}
                  placeholder={t('row.model.provider.placeholder')}
                  items={modelGroups.map(g => ({ id: g.id, label: g.name }))}
                  onSelect={id => onPatch({ model: { kind: 'manual', provider: id, model: '' } })}
                />
              </div>
              <div className={css.field}>
                <span className={css.fieldLabel}>{t('row.model.model')}</span>
                <DropdownPicker
                  value={draft.model.model}
                  placeholder={t('row.model.model.placeholder')}
                  disabled={draft.model.provider === ''}
                  items={draft.model.provider !== ''
                    ? modelGroups
                        .filter(g => g.id === draft.model.provider)
                        .flatMap(g => g.models)
                        .map(m => ({ id: m.id, label: m.name }))
                    : []}
                  onSelect={id => onPatch({ model: { kind: 'manual', provider: draft.model.provider, model: id } })}
                />
              </div>
            </>
          )}
          <label className={css.field}>
            <span className={css.fieldLabel}>{t('row.maxDepth')}</span>
            <input
              type="number"
              min={0}
              className={css.input}
              value={draft.maxDepth}
              onChange={e => onPatch({ maxDepth: Number(e.target.value) })}
            />
          </label>
        </div>
      )}
    </li>
  )
}

// ─── DropdownPicker (DSH Menu-based single-select) ───────────────────────────

interface DropdownPickerProps {
  readonly value: string
  readonly placeholder: string
  readonly items: readonly { readonly id: string; readonly label: string }[]
  readonly disabled?: boolean
  readonly onSelect: (id: string) => void
}

function DropdownPicker({ value, placeholder, items, disabled, onSelect }: DropdownPickerProps) {
  const [open, setOpen] = useState(false)
  const selectedLabel = items.find(i => i.id === value)?.label
  const menuItems: readonly MenuEntry[] = items

  return (
    <Menu
      open={open && disabled !== true}
      onClose={() => { setOpen(false) }}
      items={menuItems}
      selectedId={value === '' ? undefined : value}
      onSelect={(id) => {
        onSelect(id)
        setOpen(false)
      }}
      align="start"
      portal
      anchor={(
        <button
          type="button"
          className={css.dropdownButton}
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => { setOpen(v => !v) }}
        >
          <span className={css.dropdownButtonLabel}>
            {selectedLabel ?? placeholder}
          </span>
          <IconChevronDownOutlineMedium className={css.dropdownCaret} />
        </button>
      )}
    />
  )
}
