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
 * The persona field is a radio (inherit deployment persona vs custom text);
 * the textarea is shown only when custom. The tool filter is a select
 * (none / allow / deny); a multi-select dropdown is shown only when allow or
 * deny is picked, populated from `ya-subagent/tools.list` (the host's current
 * `ctx.tools.schemas()`).
 *
 * Pulls the profile list once on mount through the plugin's dedicated RPC
 * channel, then dispatches add/update/remove through that same channel. The
 * toolview slot is keyed by `subagent` and registered once at
 * plugin load, so profile mutations do not need to re-register slots.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/client/SettingsPage
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ClientConnectionRpc, RpcResult } from '@deepseek-ai/dsh-client-connection/client'
import { IconChevronDownOutline14, Menu, Modal, Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SubagentProfile } from '../types.ts'
import type { ProfileListResponse, ToolListResponse } from '../rpc.ts'
import { YA_SUBAGENT_RPC_CHANNEL } from '../rpc.ts'
import css from './SettingsPage.module.css'

/** Inject face: RPC handle + locale translate. */
export interface YaSubagentSettingsInjected {
  readonly rpc: ClientConnectionRpc
  /** Refetch the profile list from the host. */
  readonly fetchProfiles: () => Promise<readonly SubagentProfile[]>
  /** Bound locale translator for the ya-subagent namespace. */
  readonly t: (key: string) => string
}

/** Full props: settings.section runtime share + locale seat + inject. */
type SettingsPageProps = PropsRuntime<'settings.section'> & PropsLocale<'ya-subagent'> & YaSubagentSettingsInjected

type ProfileListResult = RpcResult<ProfileListResponse>
type ToolListResult = RpcResult<ToolListResponse>

/** A tool entry returned by `ya-subagent/tools.list`. */
interface ToolEntry {
  readonly name: string
  readonly description: string
}

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

/** Shape returned by the `llm.models` RPC. */
interface ModelCatalogResponse {
  readonly groups: readonly ModelGroup[]
  readonly failures: readonly { readonly id: string; readonly name: string; readonly message: string }[]
}

/** Default shape for a brand-new draft (before the user fills in id/label). */
function emptyDraft(): SubagentProfile {
  return {
    id: '',
    label: '',
    model: { kind: 'auto', provider: '', model: '' },
    persona: { kind: 'inherit' },
    toolFilter: { kind: 'none' },
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
  return rpc.call(YA_SUBAGENT_RPC_CHANNEL, endpoint, payload) as Promise<T>
}

/**
 * Render the subagent profiles settings page.
 * @param props - settings.section runtime share + locale + inject.
 * @returns the page element.
 */
export function SettingsPage({ rpc, fetchProfiles, t }: SettingsPageProps) {
  const [profiles, setProfiles] = useState<readonly SubagentProfile[]>([])
  const [drafts, setDrafts] = useState<readonly SubagentProfile[]>([])
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [addingNew, setAddingNew] = useState(false)
  const [newDraft, setNewDraft] = useState<SubagentProfile>(emptyDraft())
  const [toolList, setToolList] = useState<readonly ToolEntry[]>([])
  const [modelGroups, setModelGroups] = useState<readonly ModelGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)
  const [confirmDelete, setConfirmDelete] = useState<string | undefined>(undefined)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const [list, toolsResult, modelsResult] = await Promise.all([
        fetchProfiles(),
        callRpc<ToolListResult>(rpc, 'ya-subagent/tools.list', {}),
        rpc.call('/api', 'llm.models', { args: {} }) as Promise<RpcResult<ModelCatalogResponse>>,
      ])
      setProfiles(list)
      setDrafts(list.map(p => ({ ...p })))
      if (toolsResult.ok) setToolList(toolsResult.value.tools)
      else setToolList([])
      if (modelsResult.ok) setModelGroups(modelsResult.value.groups)
      else setModelGroups([])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [fetchProfiles, rpc])

  useEffect(() => { void refresh() }, [refresh])

  const addProfile = useCallback(async () => {
    if (newDraft.id === '' || newDraft.label === '') return
    const result = await callRpc<ProfileListResult>(rpc, 'ya-subagent/profiles.add', { profile: newDraft })
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
    const result = await callRpc<ProfileListResult>(rpc, 'ya-subagent/profiles.update', { profile: draft })
    if (result.ok) {
      setProfiles(result.value.profiles)
      setDrafts(result.value.profiles.map(p => ({ ...p })))
    } else {
      setError(result.error.message)
    }
  }, [rpc])

  const removeProfile = useCallback(async (id: string) => {
    const result = await callRpc<ProfileListResult>(rpc, 'ya-subagent/profiles.remove', { id })
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
              toolList={toolList}
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
              toolList={toolList}
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
      <Modal
        open={confirmDelete !== undefined}
        onClose={() => { setConfirmDelete(undefined) }}
        title={t('row.delete.confirm')}
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
  readonly toolList: readonly ToolEntry[]
  readonly modelGroups: readonly ModelGroup[]
  readonly t: (key: string) => string
  readonly onToggle?: () => void
  readonly onPatch: (patch: Partial<SubagentProfile>) => void
  readonly onSave?: () => void
  readonly onDelete?: () => void
  readonly onCreate?: () => void
  readonly onCancel?: () => void
}

function ProfileCard({ draft, expanded, isNew, toolList, modelGroups, t, onToggle, onPatch, onSave, onDelete, onCreate, onCancel }: ProfileCardProps) {
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
          <div className={css.field}>
            <span className={css.fieldLabel}>{t('row.persona')}</span>
            <div className={css.radioGroup}>
              <label className={css.radioOption}>
                <input
                  type="radio"
                  name={`persona-${draft.id}-${isNew ? 'new' : ''}`}
                  checked={draft.persona.kind === 'inherit'}
                  onChange={() => onPatch({ persona: { kind: 'inherit' } })}
                />
                {t('row.persona.kind.inherit')}
              </label>
              <label className={css.radioOption}>
                <input
                  type="radio"
                  name={`persona-${draft.id}-${isNew ? 'new' : ''}`}
                  checked={draft.persona.kind === 'custom'}
                  onChange={() => onPatch({ persona: { kind: 'custom', text: draft.persona.kind === 'custom' ? draft.persona.text : '' } })}
                />
                {t('row.persona.kind.custom')}
              </label>
            </div>
          </div>
          {draft.persona.kind === 'custom' && (
            <label className={css.field}>
              <span className={css.fieldLabel}>{t('row.persona.text')}</span>
              <textarea
                className={css.textarea}
                value={draft.persona.kind === 'custom' ? draft.persona.text : ''}
                onChange={e => onPatch({ persona: { kind: 'custom', text: e.target.value } })}
              />
            </label>
          )}
          <div className={css.field}>
            <span className={css.fieldLabel}>{t('row.toolFilter')}</span>
            <div className={css.radioGroup}>
              <label className={css.radioOption}>
                <input
                  type="radio"
                  name={`toolFilter-${draft.id}-${isNew ? 'new' : ''}`}
                  checked={draft.toolFilter.kind === 'none'}
                  onChange={() => onPatch({ toolFilter: { kind: 'none' } })}
                />
                {t('row.toolFilter.kind.none')}
              </label>
              <label className={css.radioOption}>
                <input
                  type="radio"
                  name={`toolFilter-${draft.id}-${isNew ? 'new' : ''}`}
                  checked={draft.toolFilter.kind === 'allow'}
                  onChange={() => onPatch({ toolFilter: { kind: 'allow', tools: draft.toolFilter.kind === 'allow' ? draft.toolFilter.tools : [] } })}
                />
                {t('row.toolFilter.kind.allow')}
              </label>
              <label className={css.radioOption}>
                <input
                  type="radio"
                  name={`toolFilter-${draft.id}-${isNew ? 'new' : ''}`}
                  checked={draft.toolFilter.kind === 'deny'}
                  onChange={() => onPatch({ toolFilter: { kind: 'deny', tools: draft.toolFilter.kind === 'deny' ? draft.toolFilter.tools : [] } })}
                />
                {t('row.toolFilter.kind.deny')}
              </label>
            </div>
          </div>
          {(draft.toolFilter.kind === 'allow' || draft.toolFilter.kind === 'deny') && (
            <label className={css.field}>
              <span className={css.fieldLabel}>{t('row.toolFilter.tools')}</span>
              <MultiSelect
                options={toolList}
                value={draft.toolFilter.kind === 'allow' || draft.toolFilter.kind === 'deny' ? [...draft.toolFilter.tools] : []}
                onChange={next => onPatch({ toolFilter: { kind: draft.toolFilter.kind === 'deny' ? 'deny' : 'allow', tools: next } })}
                t={t}
              />
            </label>
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

// ─── MultiSelect ─────────────────────────────────────────────────────────────

interface MultiSelectProps {
  readonly options: readonly ToolEntry[]
  readonly value: readonly string[]
  readonly onChange: (next: string[]) => void
  readonly t: (key: string) => string
}

function MultiSelect({ options, value, onChange, t }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (containerRef.current !== null && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const q = query.trim().toLowerCase()
  const filtered = q === '' ? options : options.filter(o => o.name.toLowerCase().includes(q))
  const valueSet = new Set(value)
  const filteredAllSelected = filtered.length > 0 && filtered.every(o => valueSet.has(o.name))

  const selectAllFiltered = (): void => {
    if (filteredAllSelected) {
      // Deselect all filtered entries.
      const next = value.filter(n => !filtered.some(o => o.name === n))
      onChange(next)
    } else {
      // Add all filtered entries (union with existing).
      const next = new Set(value)
      for (const o of filtered) next.add(o.name)
      onChange([...next])
    }
  }

  const toggleOne = (name: string): void => {
    if (valueSet.has(name)) onChange(value.filter(n => n !== name))
    else onChange([...value, name])
  }

  const label = value.length === 0
    ? t('row.toolFilter.tools')
    : t('row.toolFilter.tools.selected').replace('{n}', String(value.length))

  return (
    <div className={css.multiSelect} ref={containerRef}>
      <button type="button" className={css.msButton} onClick={() => setOpen(prev => !prev)}>
        <span className={css.msButtonLabel}>{label}</span>
        <IconChevronDownOutline14 className={css.msCaret} />
      </button>
      {open && (
        <div className={css.msPopup}>
          <input
            className={css.msSearch}
            placeholder={t('row.toolFilter.tools.search')}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className={css.msActions}>
            <button type="button" className={css.msActionLink} onClick={selectAllFiltered}>
              {filteredAllSelected ? t('row.toolFilter.tools.clear') : t('row.toolFilter.tools.selectAll')}
            </button>
          </div>
          <ul className={css.msList}>
            {filtered.length === 0 ? (
              <li className={css.msEmpty}>{t('row.toolFilter.tools.empty')}</li>
            ) : (
              filtered.map(o => (
                <li key={o.name} className={css.msItem}>
                  <label className={css.msItemLabel} title={o.description}>
                    <input
                      type="checkbox"
                      checked={valueSet.has(o.name)}
                      onChange={() => toggleOne(o.name)}
                    />
                    <span className={css.msItemName}>{o.name}</span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
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
          <IconChevronDownOutline14 className={css.dropdownCaret} />
        </button>
      )}
    />
  )
}
