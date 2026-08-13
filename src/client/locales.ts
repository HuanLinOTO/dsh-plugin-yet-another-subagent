/**
 * Locale dictionaries for yet-another-subagent.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/client/locales
 */

/** All copy keys for the ya-subagent namespace. */
export type YaSubagentKey =
  | 'nav'
  | 'page.title'
  | 'page.empty'
  | 'page.add'
  | 'page.add.placeholder.id'
  | 'page.add.placeholder.label'
  | 'page.add.submit'
  | 'page.add.error'
  | 'page.add.cancel'
  | 'row.label'
  | 'row.id'
  | 'row.model.kind.auto'
  | 'row.model.kind.manual'
  | 'row.model.provider'
  | 'row.model.model'
  | 'row.model.provider.placeholder'
  | 'row.model.model.placeholder'
  | 'row.model.noModels'
  | 'row.persona'
  | 'row.persona.kind.inherit'
  | 'row.persona.kind.custom'
  | 'row.persona.text'
  | 'row.toolFilter'
  | 'row.toolFilter.kind.none'
  | 'row.toolFilter.kind.allow'
  | 'row.toolFilter.kind.deny'
  | 'row.toolFilter.tools'
  | 'row.toolFilter.tools.search'
  | 'row.toolFilter.tools.empty'
  | 'row.toolFilter.tools.selected'
  | 'row.toolFilter.tools.selectAll'
  | 'row.toolFilter.tools.clear'
  | 'row.maxDepth'
  | 'row.delete'
  | 'row.delete.confirm'
  | 'row.save'
  | 'row.saved'
  | 'row.error'
  | 'row.expand'
  | 'row.collapse'
  | 'badge.builtin'
  | 'card.starting'
  | 'card.waiting'
  | 'card.idle'
  | 'card.running'
  | 'card.completed'
  | 'card.child-running'
  | 'card.child-idle'
  | 'card.toolcalls'
  | 'card.tokens'
  | 'card.calling'
  | 'card.open'
  | 'card.unavailable'
  | 'tree.tab'
  | 'tree.empty'
  | 'tree.rootHint'
  | 'tree.toolcalls'
  | 'tree.tokens'
  | 'tree.calling'
  | 'tree.state.running'
  | 'tree.state.idle'
  | 'tree.state.settled'

/** Locale namespace id. */
export const NS = 'ya-subagent'

/** English dictionary. */
export const en: Record<YaSubagentKey, string> = {
  'nav': 'Subagents',
  'page.title': 'Subagent Profiles',
  'page.empty': 'No profiles configured. Add one below.',
  'page.add': '+ Add subagent',
  'page.add.placeholder.id': 'profile-id',
  'page.add.placeholder.label': 'Display name',
  'page.add.submit': 'Create',
  'page.add.error': 'Failed to add profile',
  'page.add.cancel': 'Cancel',
  'row.label': 'Label',
  'row.id': 'ID',
  'row.model.kind.auto': 'Auto (inherit parent model)',
  'row.model.kind.manual': 'Manual',
  'row.model.provider': 'Provider',
  'row.model.model': 'Model',
  'row.model.provider.placeholder': 'Select provider…',
  'row.model.model.placeholder': 'Select model…',
  'row.model.noModels': 'No models available',
  'row.persona': 'Persona',
  'row.persona.kind.inherit': 'Inherit (default persona)',
  'row.persona.kind.custom': 'Custom',
  'row.persona.text': 'Custom persona text',
  'row.toolFilter': 'Tools',
  'row.toolFilter.kind.none': 'No restriction',
  'row.toolFilter.kind.allow': 'Whitelist',
  'row.toolFilter.kind.deny': 'Blacklist',
  'row.toolFilter.tools': 'Tools',
  'row.toolFilter.tools.search': 'Search tools…',
  'row.toolFilter.tools.empty': 'No tools found',
  'row.toolFilter.tools.selected': '{n} selected',
  'row.toolFilter.tools.selectAll': 'Select all',
  'row.toolFilter.tools.clear': 'Clear',
  'row.maxDepth': 'Max depth',
  'row.delete': 'Delete',
  'row.delete.confirm': 'Delete this profile?',
  'row.save': 'Save',
  'row.saved': 'Saved',
  'row.error': 'Failed to update profile',
  'row.expand': 'Expand',
  'row.collapse': 'Collapse',
  'badge.builtin': 'builtin',
  'card.starting': 'Starting…',
  'card.waiting': 'Waiting for child session…',
  'card.idle': 'idle',
  'card.running': 'running',
  'card.completed': 'completed',
  'card.child-running': 'running',
  'card.child-idle': 'idle',
  'card.toolcalls': 'tool calls',
  'card.tokens': 'Tokens',
  'card.calling': 'calling',
  'card.open': 'Click to open subagent session →',
  'card.unavailable': 'session unavailable',
  'tree.tab': 'Subagent Tree',
  'tree.empty': 'No subagent children in this session.',
  'tree.rootHint': 'Showing the root session\u2019s subagent tree.',
  'tree.toolcalls': 'tool calls',
  'tree.tokens': 'Tokens',
  'tree.calling': 'calling',
  'tree.state.running': 'running',
  'tree.state.idle': 'idle',
  'tree.state.settled': 'settled',
}

/** Chinese dictionary. */
export const zh: Record<YaSubagentKey, string> = {
  'nav': '子代理',
  'page.title': '子代理配置',
  'page.empty': '暂无配置，请在下方添加。',
  'page.add': '+ 添加子代理',
  'page.add.placeholder.id': 'profile-id',
  'page.add.placeholder.label': '显示名',
  'page.add.submit': '创建',
  'page.add.error': '添加失败',
  'page.add.cancel': '取消',
  'row.label': '名称',
  'row.id': 'ID',
  'row.model.kind.auto': '自动（继承父代理模型）',
  'row.model.kind.manual': '手动指定',
  'row.model.provider': 'Provider',
  'row.model.model': '模型',
  'row.model.provider.placeholder': '选择 Provider…',
  'row.model.model.placeholder': '选择模型…',
  'row.model.noModels': '无可用模型',
  'row.persona': '人设',
  'row.persona.kind.inherit': '跟随默认人设',
  'row.persona.kind.custom': '自定义',
  'row.persona.text': '自定义人设文本',
  'row.toolFilter': '工具',
  'row.toolFilter.kind.none': '不管',
  'row.toolFilter.kind.allow': '白名单',
  'row.toolFilter.kind.deny': '黑名单',
  'row.toolFilter.tools': '工具列表',
  'row.toolFilter.tools.search': '搜索工具…',
  'row.toolFilter.tools.empty': '未找到工具',
  'row.toolFilter.tools.selected': '已选 {n} 个',
  'row.toolFilter.tools.selectAll': '全选',
  'row.toolFilter.tools.clear': '清空',
  'row.maxDepth': '最大递归深度',
  'row.delete': '删除',
  'row.delete.confirm': '确定删除此配置？',
  'row.save': '保存',
  'row.saved': '已保存',
  'row.error': '保存失败',
  'row.expand': '展开',
  'row.collapse': '收起',
  'badge.builtin': '内置',
  'card.starting': '启动中…',
  'card.waiting': '等待子会话…',
  'card.idle': '空闲',
  'card.running': '运行中',
  'card.completed': '已完成',
  'card.child-running': '运行中',
  'card.child-idle': '空闲',
  'card.toolcalls': '次工具调用',
  'card.tokens': 'Tokens',
  'card.calling': '调用中',
  'card.open': '点击打开子代理会话 →',
  'card.unavailable': '会话不可用',
  'tree.tab': '子代理树',
  'tree.empty': '当前会话暂无子代理。',
  'tree.rootHint': '显示根会话的子代理树。',
  'tree.toolcalls': '次工具调用',
  'tree.tokens': 'Tokens',
  'tree.calling': '调用中',
  'tree.state.running': '运行中',
  'tree.state.idle': '空闲',
  'tree.state.settled': '已结束',
}
