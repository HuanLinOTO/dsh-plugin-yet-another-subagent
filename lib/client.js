window.__ModuleLoader__.load({
	id: "@huanlin/dsh-plugin-yet-another-subagent",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region \0dsh-css:D:\Projects\deepseek-harness\yet-another-subagent\src\client\SubagentCard.module.css.mjs
		const css$2 = "/* SubagentCard toolview: a proper card with border, padding, and rounded\n * corners. Three display branches: running (spinner), continuable (live\n * child stats), foreground completed (output preview).\n *\n * Every color resolves through a --dsw-alias-* token (no literal colors). */\n\n.d8sln8w_card {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 10px 12px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 8px;\n  background: var(--dsw-alias-bg-layer-1);\n  transition: border-color 0.15s ease;\n}\n\n.d8sln8w_card[data-clickable] {\n  cursor: pointer;\n}\n\n.d8sln8w_card[data-clickable]:hover {\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n/* ---- Header: state dot + title + state badge ---- */\n\n.d8sln8w_header {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n}\n\n.d8sln8w_stateDot {\n  flex: none;\n  width: 8px;\n  height: 8px;\n  border-radius: 50%;\n  background: var(--dsw-alias-label-caption);\n  transition: background 0.15s ease;\n}\n\n/* Running: pulsing brand-color dot */\n.d8sln8w_card[data-state='running'] .d8sln8w_stateDot,\n.d8sln8w_card[data-state='child-running'] .d8sln8w_stateDot {\n  background: var(--dsw-alias-brand-primary);\n  animation: dsh-ya-subagent-pulse 1.4s ease-in-out infinite;\n}\n\n/* Completed: success green */\n.d8sln8w_card[data-state='completed'] .d8sln8w_stateDot {\n  background: var(--dsw-alias-state-success-primary);\n}\n\n/* Child idle: success green (turn done, conversation alive) */\n.d8sln8w_card[data-state='child-idle'] .d8sln8w_stateDot {\n  background: var(--dsw-alias-state-success-primary);\n}\n\n@keyframes dsh-ya-subagent-pulse {\n  0%, 100% { opacity: 1; }\n  50% { opacity: 0.4; }\n}\n\n.d8sln8w_title {\n  flex: 1 1 auto;\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 20px;\n  color: var(--dsw-alias-label-primary);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.d8sln8w_stateBadge {\n  flex: none;\n  font-size: 11px;\n  line-height: 18px;\n  padding: 0 6px;\n  border-radius: 4px;\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-tertiary);\n}\n\n/* Running / child-running: shimmer sweep over the state badge text,\n * mirroring DSH's \"Deep diving...\" turn-status effect. The pill background\n * is dropped so background-clip: text can show the gradient through the glyphs. */\n.d8sln8w_card[data-state='running'] .d8sln8w_stateBadge,\n.d8sln8w_card[data-state='child-running'] .d8sln8w_stateBadge {\n  padding: 0;\n  background: linear-gradient(\n    90deg,\n    var(--dsw-static-deepseek-500) 0%,\n    var(--dsw-static-deepseek-500) 40%,\n    var(--dsw-static-deepseek-200) 50%,\n    var(--dsw-static-deepseek-500) 60%,\n    var(--dsw-static-deepseek-500) 100%\n  );\n  background-position: 100% 0;\n  background-size: 250% 100%;\n  background-clip: text;\n  color: transparent;\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n  animation: dsh-ya-subagent-shimmer 1.8s linear infinite;\n}\n\n@keyframes dsh-ya-subagent-shimmer {\n  to {\n    background-position: 0 0;\n  }\n}\n\n.d8sln8w_card[data-state='completed'] .d8sln8w_stateBadge,\n.d8sln8w_card[data-state='child-idle'] .d8sln8w_stateBadge {\n  color: var(--dsw-alias-state-success-primary);\n}\n\n/* ---- Body: stats or output preview ---- */\n\n.d8sln8w_body {\n  min-height: 18px;\n}\n\n.d8sln8w_stats {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  font-size: 11px;\n  line-height: 16px;\n  font-variant-numeric: tabular-nums;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.d8sln8w_stat {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n}\n\n.d8sln8w_activity {\n  margin-top: 4px;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.d8sln8w_output {\n  display: block;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n  overflow: hidden;\n  display: -webkit-box;\n  -webkit-line-clamp: 3;\n  -webkit-box-orient: vertical;\n}\n\n/* ---- Footer: click hint ---- */\n\n.d8sln8w_footer {\n  font-size: 11px;\n  line-height: 16px;\n  color: var(--dsw-alias-label-dimmed);\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .d8sln8w_card[data-state='running'] .d8sln8w_stateDot,\n  .d8sln8w_card[data-state='child-running'] .d8sln8w_stateDot {\n    animation: none;\n  }\n  .d8sln8w_card[data-state='running'] .d8sln8w_stateBadge,\n  .d8sln8w_card[data-state='child-running'] .d8sln8w_stateBadge {\n    background-position: 0 0;\n    background-size: 100% 100%;\n    animation: none;\n  }\n}\n";
		const classMap$2 = {
			"card": "d8sln8w_card",
			"header": "d8sln8w_header",
			"stateDot": "d8sln8w_stateDot",
			"title": "d8sln8w_title",
			"stateBadge": "d8sln8w_stateBadge",
			"body": "d8sln8w_body",
			"stats": "d8sln8w_stats",
			"stat": "d8sln8w_stat",
			"activity": "d8sln8w_activity",
			"output": "d8sln8w_output",
			"footer": "d8sln8w_footer"
		};
		const tagId$2 = "@huanlin/dsh-plugin-yet-another-subagent/SubagentCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@huanlin/dsh-plugin-yet-another-subagent";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region src/client/SubagentCard.tsx
		/**
		* SubagentCard — the model-facing toolcall card for the `subagent` tool.
		*
		* Three display branches:
		*   1. **Running** (block is `RunningToolCall`): the tool call is in flight.
		*      Show "running" with a spinner dot; no child session to subscribe to.
		*   2. **Continuable settled** (result text matches `started <label>
		*      subagent <id>`): subscribe to the child's `yaSubagentProgress`
		*      projection for live toolcall/token counts; clickable to open.
		*   3. **Foreground settled** (result text is the child's output): the
		*      one-shot child has completed; show "completed" with an output
		*      preview. No child session survives.
		*
		* @module @huanlin/dsh-plugin-yet-another-subagent/client/SubagentCard
		*/
		/** Parse `block.content` for:
		*   - background:  `started background subagent task <taskId>`
		*   - continuable: `started <profileLabel> subagent <subagentId>`
		*   - foreground:  `completed <profileLabel> subagent <runId>\n<output>`
		*   - foreground (legacy): plain output text (no embedded id, not clickable)
		*/
		function parseResult(block) {
			if (!("kind" in block)) return {};
			const texts = [];
			for (const item of block.content) {
				if (item.type !== "text") continue;
				if (item.text.match(/^started background subagent task \S+$/) !== null) return {};
				const continuableMatch = item.text.match(/^started (\S+) subagent (\S+)$/);
				if (continuableMatch !== null && continuableMatch[1] !== void 0 && continuableMatch[2] !== void 0) return {
					profileLabel: continuableMatch[1],
					subagentId: continuableMatch[2],
					continuable: true
				};
				const foregroundMatch = item.text.match(/^completed (\S+) subagent (\S+)\n([\s\S]*)$/);
				if (foregroundMatch !== null && foregroundMatch[1] !== void 0 && foregroundMatch[2] !== void 0 && foregroundMatch[3] !== void 0) return {
					profileLabel: foregroundMatch[1],
					subagentId: foregroundMatch[2],
					continuable: false,
					output: foregroundMatch[3]
				};
				texts.push(item.text);
			}
			const output = texts.join("").trim();
			return output !== "" ? { output } : {};
		}
		/** Extract the `profile` parameter from a running or settled block's raw arguments. */
		function readProfileArg(block) {
			const argsRaw = "argsRaw" in block ? block.argsRaw : block.call?.argsRaw;
			if (argsRaw === void 0) return void 0;
			try {
				const parsed = JSON.parse(argsRaw);
				return typeof parsed.profile === "string" ? parsed.profile : void 0;
			} catch {
				return;
			}
		}
		/** Truncate a foreground output preview to a reasonable card line. */
		function truncate(text, max) {
			const single = text.replace(/\s+/g, " ").trim();
			return single.length > max ? single.slice(0, max) + "…" : single;
		}
		/** Format token totals compactly: >=1000 uses "k", <1000 uses plain count. */
		function formatTokens$1(tokens, t) {
			if (tokens === void 0) return `0 ${t("card.tokens")}`;
			const total = tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite + tokens.reasoning;
			return `${total >= 1e3 ? `${(total / 1e3).toFixed(1)}k` : String(total)} ${t("card.tokens")}`;
		}
		/**
		* Subscribe to a child session's `yaSubagentProgress` projection through the
		* sessions binding face. Returns `undefined` while the binding is absent or
		* the projection has not pushed yet.
		*/
		function useChildProgress$1(sessions, childId) {
			const [progress, setProgress] = (0, react.useState)(void 0);
			(0, react.useEffect)(() => {
				if (childId === void 0) return;
				const binding = sessions.binding(childId);
				if (binding === void 0) return;
				const face = binding.session.projections.faceOf("yaSubagentProgress");
				if (face === void 0) return;
				const snapshot = face.getSnapshot();
				setProgress(snapshot ?? void 0);
				return face.subscribe(() => {
					const next = face.getSnapshot();
					setProgress(next ?? void 0);
				});
			}, [sessions, childId]);
			return progress;
		}
		/**
		* Subscribe to the parent session's `subagentProfile` projection to resolve
		* a running call's childId (before the result text embeds it). Returns the
		* childId for this callId, or undefined.
		*/
		function useChildIdFromProjection(sessions, sessionId, callId) {
			const [childId, setChildId] = (0, react.useState)(void 0);
			(0, react.useEffect)(() => {
				const binding = sessions.binding(sessionId);
				if (binding === void 0) return;
				const face = binding.session.projections.faceOf("subagentProfile");
				if (face === void 0) return;
				const read = () => {
					return face.getSnapshot()?.calls?.[callId];
				};
				setChildId(read());
				return face.subscribe(() => setChildId(read()));
			}, [
				sessions,
				sessionId,
				callId
			]);
			return childId;
		}
		/**
		* Render one `subagent` tool call as a compact live card.
		* @param props - keyed toolview payload + locale seat + sessions inject.
		* @returns the dedicated subagent card.
		*/
		function SubagentCard({ block, callId, toolName, sessionId, sessions, profileLabelOf, t }) {
			const result = parseResult(block);
			const projectedChildId = useChildIdFromProjection(sessions, sessionId, callId);
			const childId = result.subagentId ?? projectedChildId;
			const profileId = readProfileArg(block);
			const profileLabel = result.profileLabel ?? (profileId !== void 0 ? profileLabelOf(profileId) : void 0) ?? toolName;
			const progress = useChildProgress$1(sessions, childId);
			const isRunning = !("kind" in block);
			const isContinuable = childId !== void 0;
			const liveState = progress?.state;
			const cardState = isRunning ? "running" : isContinuable ? liveState === "running" ? "child-running" : "child-idle" : "completed";
			const toolCallCount = progress?.toolCallCount ?? 0;
			const clickable = childId !== void 0;
			const openChild = () => {
				if (childId === void 0) return;
				const parentId = sessionId;
				const retained = sessions.subagentAddress?.(childId);
				if (retained !== void 0) try {
					sessions.openSubagent(retained);
					return;
				} catch {}
				for (const mode of ["continuable", "one-shot"]) try {
					sessions.openSubagent({
						parentSessionId: parentId,
						childSessionId: childId,
						mode
					});
					return;
				} catch {}
				sessions.refreshSubagents(parentId).then(() => {
					const r = sessions.subagentAddress?.(childId);
					if (r !== void 0) try {
						sessions.openSubagent(r);
					} catch (e) {
						console.error("[ya-subagent] openSubagent failed after refresh:", e);
					}
					else console.error("[ya-subagent] child not found in catalog after refresh:", childId);
				}).catch((e) => {
					console.error("[ya-subagent] refreshSubagents failed:", e);
				});
			};
			const stateLabel = t(`card.${cardState}`);
			const showOutput = cardState === "completed" && result.output !== void 0;
			const activity = progress?.activity;
			const activityText = activity === void 0 ? void 0 : activity.kind === "tool" ? activity.args !== void 0 ? `${activity.name} ${activity.args}` : `${t("card.calling")} ${activity.name}` : activity.text;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: classMap$2.card,
				"data-tool": toolName,
				"data-state": cardState,
				"data-clickable": clickable || void 0,
				onClick: clickable ? openChild : void 0,
				role: clickable ? "button" : void 0,
				tabIndex: clickable ? 0 : void 0,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: classMap$2.header,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: classMap$2.stateDot,
								"aria-hidden": true
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: classMap$2.title,
								children: profileLabel
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: classMap$2.stateBadge,
								children: stateLabel
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: classMap$2.body,
						children: showOutput ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: classMap$2.output,
							children: truncate(result.output, 200)
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: classMap$2.stats,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: classMap$2.stat,
								children: [
									toolCallCount,
									" ",
									t("card.toolcalls")
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: classMap$2.stat,
								children: formatTokens$1(progress?.tokens, t)
							})]
						}), activityText !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: classMap$2.activity,
							title: activityText,
							children: activityText
						})] })
					}),
					clickable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: classMap$2.footer,
						children: t("card.open")
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:D:\Projects\deepseek-harness\yet-another-subagent\src\client\SubagentTreeView.module.css.mjs
		const css$1 = "/* SubagentTreeView: a recursive tree of subagent children with live progress. */\n\n.dkph7p9_tree {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  padding: 16px;\n  max-width: 720px;\n  margin: 0 auto;\n}\n\n.dkph7p9_rootHint {\n  font-size: 11px;\n  line-height: 16px;\n  color: var(--dsw-alias-label-tertiary);\n  margin-bottom: 4px;\n}\n\n.dkph7p9_empty {\n  padding: 32px 16px;\n  text-align: center;\n  font-size: 13px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.dkph7p9_childList {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.dkph7p9_node {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.dkph7p9_row {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  padding: 10px 12px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 8px;\n  background: var(--dsw-alias-bg-layer-1);\n  cursor: pointer;\n  transition: border-color 0.15s ease, background 0.15s ease;\n}\n\n.dkph7p9_row:hover {\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.dkph7p9_row:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: 2px;\n}\n\n/* Highlight the currently open session. */\n.dkph7p9_row[data-current] {\n  border-color: var(--dsw-alias-brand-primary);\n  background: var(--dsw-alias-bg-layer-2);\n}\n\n.dkph7p9_rowHeader {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n}\n\n.dkph7p9_dot {\n  flex: none;\n  width: 8px;\n  height: 8px;\n  border-radius: 50%;\n  background: var(--dsw-alias-label-caption);\n  transition: background 0.15s ease;\n}\n\n.dkph7p9_row[data-state='running'] .dkph7p9_dot {\n  background: var(--dsw-alias-brand-primary);\n  animation: dsh-ya-tree-pulse 1.4s ease-in-out infinite;\n}\n\n.dkph7p9_row[data-state='idle'] .dkph7p9_dot,\n.dkph7p9_row[data-state='settled'] .dkph7p9_dot {\n  background: var(--dsw-alias-state-success-primary);\n}\n\n@keyframes dsh-ya-tree-pulse {\n  0%, 100% { opacity: 1; }\n  50% { opacity: 0.4; }\n}\n\n.dkph7p9_label {\n  flex: 1 1 auto;\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 20px;\n  color: var(--dsw-alias-label-primary);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dkph7p9_badge {\n  flex: none;\n  font-size: 11px;\n  line-height: 18px;\n  padding: 0 6px;\n  border-radius: 4px;\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.dkph7p9_row[data-state='running'] .dkph7p9_badge {\n  padding: 0;\n  background: linear-gradient(\n    90deg,\n    var(--dsw-static-deepseek-500) 0%,\n    var(--dsw-static-deepseek-500) 40%,\n    var(--dsw-static-deepseek-200) 50%,\n    var(--dsw-static-deepseek-500) 60%,\n    var(--dsw-static-deepseek-500) 100%\n  );\n  background-position: 100% 0;\n  background-size: 250% 100%;\n  background-clip: text;\n  color: transparent;\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n  animation: dsh-ya-tree-shimmer 1.8s linear infinite;\n}\n\n@keyframes dsh-ya-tree-shimmer {\n  to { background-position: 0 0; }\n}\n\n.dkph7p9_rowStats {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  font-size: 11px;\n  line-height: 16px;\n  font-variant-numeric: tabular-nums;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.dkph7p9_stat {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n}\n\n.dkph7p9_activity {\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .dkph7p9_row[data-state='running'] .dkph7p9_dot {\n    animation: none;\n  }\n  .dkph7p9_row[data-state='running'] .dkph7p9_badge {\n    background-position: 0 0;\n    background-size: 100% 100%;\n    animation: none;\n  }\n}\n";
		const classMap$1 = {
			"tree": "dkph7p9_tree",
			"rootHint": "dkph7p9_rootHint",
			"empty": "dkph7p9_empty",
			"childList": "dkph7p9_childList",
			"node": "dkph7p9_node",
			"row": "dkph7p9_row",
			"rowHeader": "dkph7p9_rowHeader",
			"dot": "dkph7p9_dot",
			"label": "dkph7p9_label",
			"badge": "dkph7p9_badge",
			"rowStats": "dkph7p9_rowStats",
			"stat": "dkph7p9_stat",
			"activity": "dkph7p9_activity"
		};
		const tagId$1 = "@huanlin/dsh-plugin-yet-another-subagent/SubagentTreeView.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@huanlin/dsh-plugin-yet-another-subagent";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region src/client/SubagentTreeView.tsx
		/**
		* SubagentTreeView — a `conversation.view` entry showing the root session's
		* full subagent tree (all depths) with live progress.
		*
		* Uses `sessions.subagentsByParent` (the catalog) as the primary tree
		* structure source — this works for ALL depths without needing per-session
		* bindings. `setSubagentCatalogOpen` keeps catalogs auto-refreshing.
		* Projections (`yaSubagentProgress`) are used additionally when a session
		* binding is available (current session + opened children) for richer data.
		*
		* @module @huanlin/dsh-plugin-yet-another-subagent/client/SubagentTreeView
		*/
		/** Walk up `subagentAddress` to find the root session id. */
		function findRootSession(sessions, sessionId) {
			let current = sessionId;
			for (let i = 0; i < 32; i++) {
				const addr = sessions.subagentAddress?.(current);
				if (addr === void 0) return current;
				current = addr.parentSessionId;
			}
			return sessionId;
		}
		/** Subscribe to a session's `subagentProfile` projection → children map. */
		function useChildren(sessions, sessionId) {
			const [children, setChildren] = (0, react.useState)({});
			(0, react.useEffect)(() => {
				const binding = sessions.binding(sessionId);
				if (binding === void 0) return;
				const face = binding.session.projections.faceOf("subagentProfile");
				if (face === void 0) return;
				const read = () => {
					const snap = face.getSnapshot();
					setChildren(snap?.children ?? {});
				};
				read();
				return face.subscribe(read);
			}, [sessions, sessionId]);
			return children;
		}
		/** Subscribe to a child session's `yaSubagentProgress` projection (if binding exists). */
		function useChildProgress(sessions, childId) {
			const [progress, setProgress] = (0, react.useState)(void 0);
			(0, react.useEffect)(() => {
				const binding = sessions.binding(childId);
				if (binding === void 0) return;
				const face = binding.session.projections.faceOf("yaSubagentProgress");
				if (face === void 0) return;
				const snapshot = face.getSnapshot();
				setProgress(snapshot ?? void 0);
				return face.subscribe(() => {
					const next = face.getSnapshot();
					setProgress(next ?? void 0);
				});
			}, [sessions, childId]);
			return progress;
		}
		/**
		* Recursively refresh catalogs for a session and all its descendants.
		* Returns immediately — `subagentsByParent` updates reactively.
		*/
		function refreshTree(sessions, parentId) {
			sessions.refreshSubagents(parentId).then(() => {
				const catalog = sessions.subagentsByParent?.[parentId];
				if (catalog === void 0) return;
				for (const entry of catalog.entries) if (entry.kind === "child" && entry.hasChildren === true) refreshTree(sessions, entry.id);
			}).catch(() => {});
		}
		/** Format token totals: >=1000 uses "k", <1000 uses plain count. */
		function formatTokens(tokens, t) {
			if (tokens === void 0) return `0 ${t("tree.tokens")}`;
			const total = tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite + tokens.reasoning;
			return `${total >= 1e3 ? `${(total / 1e3).toFixed(1)}k` : String(total)} ${t("tree.tokens")}`;
		}
		function buildTree(sessions, parentId, projectionChildren, profileLabelOf, visited) {
			const catalog = sessions.subagentsByParent?.[parentId];
			if (catalog === void 0) return [];
			const nodes = [];
			for (const entry of catalog.entries) {
				if (entry.kind !== "child") continue;
				if (visited.has(entry.id)) continue;
				visited.add(entry.id);
				const profileId = projectionChildren[entry.id];
				const label = (profileId !== void 0 ? profileLabelOf(profileId) : void 0) ?? entry.label ?? entry.id;
				const childProjectionChildren = {};
				const binding = sessions.binding(entry.id);
				if (binding !== void 0) {
					const face = binding.session.projections.faceOf("subagentProfile");
					if (face !== void 0) {
						const snap = face.getSnapshot();
						if (snap?.children !== void 0) for (const [k, v] of Object.entries(snap.children)) childProjectionChildren[k] = v;
					}
				}
				const children = entry.hasChildren === true ? buildTree(sessions, entry.id, childProjectionChildren, profileLabelOf, visited) : [];
				nodes.push({
					id: entry.id,
					label,
					mode: entry.mode,
					catalogActivity: entry.activity,
					hasChildren: children.length > 0,
					children
				});
			}
			return nodes;
		}
		/**
		* Render the subagent tree view. Always shows the ROOT session's full tree;
		* highlights the current session if it is a subagent.
		*/
		function SubagentTreeView({ sessionId, sessions, profileLabelOf, t }) {
			const rootId = findRootSession(sessions, sessionId);
			const isSubagent = rootId !== sessionId;
			(0, react.useEffect)(() => {
				sessions.setSubagentCatalogOpen(rootId, true);
				refreshTree(sessions, rootId);
				return () => {
					sessions.setSubagentCatalogOpen(rootId, false);
				};
			}, [sessions, rootId]);
			const projectionChildren = useChildren(sessions, rootId);
			const [, setTick] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				const interval = setInterval(() => setTick((t) => t + 1), 2e3);
				return () => clearInterval(interval);
			}, []);
			const tree = (0, react.useMemo)(() => buildTree(sessions, rootId, projectionChildren, profileLabelOf, /* @__PURE__ */ new Set()), [
				sessions,
				rootId,
				projectionChildren,
				profileLabelOf,
				sessions.subagentsByParent
			]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: classMap$1.tree,
				children: [isSubagent && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: classMap$1.rootHint,
					children: t("tree.rootHint")
				}), tree.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: classMap$1.empty,
					children: t("tree.empty")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TreeNodes, {
					nodes: tree,
					currentSessionId: sessionId,
					sessions,
					t,
					depth: 0
				})]
			});
		}
		/** Render a list of tree nodes. */
		function TreeNodes({ nodes, currentSessionId, sessions, t, depth }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: classMap$1.childList,
				children: nodes.map((node) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TreeNodeView, {
					node,
					currentSessionId,
					sessions,
					t,
					depth
				}, node.id))
			});
		}
		/** One tree node row + its children (recursively). */
		function TreeNodeView({ node, currentSessionId, sessions, t, depth }) {
			const progress = useChildProgress(sessions, node.id);
			const isCurrent = node.id === currentSessionId;
			const state = progress?.state ?? (node.catalogActivity === "running" ? "running" : "idle");
			const stateLabel = t(`tree.state.${state}`);
			const toolCallCount = progress?.toolCallCount ?? 0;
			const tokens = formatTokens(progress?.tokens, t);
			const activity = progress?.activity;
			const activityText = activity === void 0 ? void 0 : activity.kind === "tool" ? activity.args !== void 0 ? `${activity.name} ${activity.args}` : `${t("tree.calling")} ${activity.name}` : activity.text;
			const openChild = () => {
				const retained = sessions.subagentAddress?.(node.id);
				if (retained !== void 0) try {
					sessions.openSubagent(retained);
					return;
				} catch {}
				const addr = sessions.subagentAddress?.(node.id);
				if (addr !== void 0) try {
					sessions.openSubagent(addr);
					return;
				} catch {}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: classMap$1.node,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: classMap$1.row,
					"data-state": state,
					"data-current": isCurrent || void 0,
					style: { paddingLeft: `${12 + depth * 20}px` },
					onClick: openChild,
					role: "button",
					tabIndex: 0,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: classMap$1.rowHeader,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: classMap$1.dot,
									"aria-hidden": true
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: classMap$1.label,
									children: node.label
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: classMap$1.badge,
									children: stateLabel
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: classMap$1.rowStats,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: classMap$1.stat,
								children: [
									toolCallCount,
									" ",
									t("tree.toolcalls")
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: classMap$1.stat,
								children: tokens
							})]
						}),
						activityText !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: classMap$1.activity,
							title: activityText,
							children: activityText
						})
					]
				}), node.children.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TreeNodes, {
					nodes: node.children,
					currentSessionId,
					sessions,
					t,
					depth: depth + 1
				})]
			});
		}
		//#endregion
		//#region \0dsh-css:D:\Projects\deepseek-harness\yet-another-subagent\src\client\SettingsPage.module.css.mjs
		const css = "/* Subagent settings section, in the settings-panel design language shared\r\n * with ModelsSection / GeneralSection: 14/22 body, 12/18 caption, 16/24 title,\r\n * capsule controls (h36 r18 primary, h28 r14 secondary), 32px fields,\r\n * border-l2 hairlines, and the editor as a filled module on the panel fill.\r\n *\r\n * Every color resolves through a --dsw-alias-* token (no literal colors). */\r\n\r\n.dun7765_section {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 12px;\r\n  max-width: 720px;\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.dun7765_title {\r\n  margin: 0;\r\n  font-size: 16px;\r\n  line-height: 24px;\r\n  font-weight: 500;\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.dun7765_intro {\r\n  margin: 0;\r\n  font-size: 14px;\r\n  line-height: 22px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n}\r\n\r\n.dun7765_error {\r\n  margin: 0;\r\n  padding: 8px 12px;\r\n  border: 1px solid var(--dsw-alias-state-error-primary);\r\n  border-radius: 8px;\r\n  background: var(--dsw-alias-interactive-bg-hover-danger);\r\n  font-size: 12px;\r\n  line-height: 18px;\r\n  color: var(--dsw-alias-state-error-primary);\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: space-between;\r\n  gap: 8px;\r\n}\r\n\r\n.dun7765_errorDismiss {\r\n  flex: none;\r\n  border: none;\r\n  background: transparent;\r\n  color: inherit;\r\n  font-size: 16px;\r\n  line-height: 1;\r\n  cursor: pointer;\r\n  padding: 0 4px;\r\n}\r\n\r\n.dun7765_rows {\r\n  list-style: none;\r\n  margin: 12px 0 0;\r\n  padding: 0;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 8px;\r\n}\r\n\r\n/* A configured profile: outlined on the panel fill, matching the rowCard\r\n * chrome in ModelsSection. */\r\n.dun7765_rowCard {\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 12px;\r\n  padding: 12px 14px;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 12px;\r\n}\r\n\r\n.dun7765_rowHead {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 10px;\r\n}\r\n\r\n/* Chevron toggle: a small square with two borders, rotated to point right\r\n * (collapsed) or down (expanded). Pure CSS, no icon font. */\r\n.dun7765_chevronButton {\r\n  flex: none;\r\n  width: 24px;\r\n  height: 24px;\r\n  display: inline-flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  border: none;\r\n  background: transparent;\r\n  color: var(--dsw-alias-label-secondary);\r\n  cursor: pointer;\r\n  padding: 0;\r\n  border-radius: 4px;\r\n}\r\n\r\n.dun7765_chevronButton:hover {\r\n  background: var(--dsw-alias-interactive-bg-hover-solid);\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n/* Spacer that occupies the chevron slot on cards without a toggle (e.dun7765_g. the\r\n * new-draft card, which is always expanded). Keeps row-head alignment. */\r\n.dun7765_chevronSpacer {\r\n  flex: none;\r\n  width: 24px;\r\n  height: 24px;\r\n}\r\n\r\n.dun7765_chevron {\r\n  width: 7px;\r\n  height: 7px;\r\n  border-right: 1.5px solid currentColor;\r\n  border-bottom: 1.5px solid currentColor;\r\n  transform: rotate(-45deg);\r\n  transition: transform 0.15s ease;\r\n}\r\n\r\n.dun7765_chevronExpanded {\r\n  transform: rotate(45deg);\r\n}\r\n\r\n.dun7765_rowIdentity {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 6px;\r\n  min-width: 0;\r\n  flex: 1 1 auto;\r\n}\r\n\r\n.dun7765_rowName {\r\n  font-size: 14px;\r\n  line-height: 22px;\r\n  font-weight: 500;\r\n  color: var(--dsw-alias-label-primary);\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.dun7765_rowNamePlaceholder {\r\n  font-size: 14px;\r\n  line-height: 22px;\r\n  font-weight: 500;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font-style: italic;\r\n}\r\n\r\n/* Builtin badge: uses DSH <Pill> with a brand-colored override to mark\r\n * seed profiles. The Pill's default chrome is bg-layer-2/label-secondary;\r\n * this override shifts it to the brand fill for the \"builtin\" emphasis. */\r\n.dun7765_builtinBadge {\r\n  height: 18px;\r\n  padding: 0 6px;\r\n  border-radius: 4px;\r\n  font-size: 11px;\r\n  line-height: 16px;\r\n  font-weight: 500;\r\n  background: var(--dsw-alias-brand-primary);\r\n  color: var(--dsw-alias-label-primary-foreground);\r\n  letter-spacing: 0.02em;\r\n}\r\n\r\n.dun7765_rowId {\r\n  flex: none;\r\n  padding: 1px 6px;\r\n  border: 1px solid var(--dsw-alias-border-l3);\r\n  border-radius: 4px;\r\n  font-size: 11px;\r\n  line-height: 16px;\r\n  font-family: var(--dsw-font-markdown-code-block-small, monospace);\r\n  color: var(--dsw-alias-label-secondary);\r\n}\r\n\r\n.dun7765_rowActions {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 4px;\r\n  margin-left: auto;\r\n  flex: none;\r\n}\r\n\r\n/* Editor surface: a filled module on the panel, matching ModelsSection's\r\n * editor chrome (bg-module-platform, r12, p14/16). */\r\n.dun7765_editor {\r\n  border-radius: 12px;\r\n  background: var(--dsw-alias-bg-module-platform);\r\n  padding: 14px 16px;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 14px;\r\n}\r\n\r\n.dun7765_field {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 6px;\r\n}\r\n\r\n.dun7765_fieldLabel {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 10px;\r\n  font-size: 12px;\r\n  line-height: 18px;\r\n  font-weight: 500;\r\n  color: var(--dsw-alias-label-secondary);\r\n}\r\n\r\n.dun7765_fieldControl {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 6px;\r\n}\r\n\r\n/* Input: matching ModelsSection .dun7765_input — h32, r8, border-l2, bg-layer-1. */\r\n.dun7765_input {\r\n  box-sizing: border-box;\r\n  width: 100%;\r\n  height: 32px;\r\n  padding: 0 10px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 8px;\r\n  font: inherit;\r\n  font-size: 14px;\r\n  line-height: 22px;\r\n  background: var(--dsw-alias-bg-layer-1);\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.dun7765_input:focus {\r\n  outline: none;\r\n  border-color: var(--dsw-alias-brand-primary);\r\n}\r\n\r\n.dun7765_input::placeholder {\r\n  color: var(--dsw-alias-label-dimmed);\r\n}\r\n\r\n.dun7765_input:disabled {\r\n  opacity: 0.6;\r\n  cursor: default;\r\n}\r\n\r\n/* DropdownPicker button: same chrome as .dun7765_input (h32, r8, border-l2,\r\n * bg-layer-1) but a button element with a trailing chevron icon. The\r\n * popup list is rendered by DSH's <Menu> component (portal mode). */\r\n.dun7765_dropdownButton {\r\n  box-sizing: border-box;\r\n  width: 100%;\r\n  height: 32px;\r\n  padding: 0 10px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 8px;\r\n  font: inherit;\r\n  font-size: 14px;\r\n  line-height: 22px;\r\n  background: var(--dsw-alias-bg-layer-1);\r\n  color: var(--dsw-alias-label-primary);\r\n  cursor: pointer;\r\n  display: inline-flex;\r\n  align-items: center;\r\n  justify-content: space-between;\r\n  gap: 8px;\r\n}\r\n\r\n.dun7765_dropdownButton:hover:not(:disabled) {\r\n  border-color: var(--dsw-alias-brand-primary);\r\n}\r\n\r\n.dun7765_dropdownButton:focus-visible {\r\n  outline: none;\r\n  border-color: var(--dsw-alias-brand-primary);\r\n  box-shadow: 0 0 0 2px var(--dsw-alias-border-l3);\r\n}\r\n\r\n.dun7765_dropdownButton:disabled {\r\n  opacity: 0.6;\r\n  cursor: default;\r\n}\r\n\r\n.dun7765_dropdownButtonLabel {\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n  flex: 1 1 auto;\r\n  text-align: left;\r\n}\r\n\r\n.dun7765_dropdownCaret {\r\n  flex: none;\r\n  opacity: 0.6;\r\n}\r\n\r\n.dun7765_textarea {\r\n  box-sizing: border-box;\r\n  width: 100%;\r\n  min-height: 64px;\r\n  padding: 6px 10px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 8px;\r\n  font: inherit;\r\n  font-size: 14px;\r\n  line-height: 22px;\r\n  background: var(--dsw-alias-bg-layer-1);\r\n  color: var(--dsw-alias-label-primary);\r\n  resize: vertical;\r\n}\r\n\r\n.dun7765_textarea:focus {\r\n  outline: none;\r\n  border-color: var(--dsw-alias-brand-primary);\r\n}\r\n\r\n.dun7765_textarea::placeholder {\r\n  color: var(--dsw-alias-label-dimmed);\r\n}\r\n\r\n/* Radio group: inline, matching the model.dun7765_kind auto/manual picker. */\r\n.dun7765_radioGroup {\r\n  display: flex;\r\n  gap: 16px;\r\n  flex-wrap: wrap;\r\n}\r\n\r\n.dun7765_radioOption {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 6px;\r\n  font-size: 14px;\r\n  line-height: 22px;\r\n  color: var(--dsw-alias-label-secondary);\r\n  cursor: pointer;\r\n}\r\n\r\n.dun7765_radioOption input[type='radio'] {\r\n  margin: 0;\r\n  cursor: pointer;\r\n}\r\n\r\n/* Buttons: capsule controls matching ModelsSection (h36 r18 primary,\r\n * h28 r14 secondary in row context). */\r\n.dun7765_primaryButton,\r\n.dun7765_secondaryButton,\r\n.dun7765_dangerButton,\r\n.dun7765_addBlockButton {\r\n  box-sizing: border-box;\r\n  display: inline-flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  gap: 4px;\r\n  height: 36px;\r\n  padding: 0 14px;\r\n  border: none;\r\n  border-radius: 18px;\r\n  font: inherit;\r\n  font-size: 14px;\r\n  line-height: 22px;\r\n  cursor: pointer;\r\n}\r\n\r\n.dun7765_primaryButton {\r\n  background: var(--dsw-alias-button-primary-fill);\r\n  color: var(--dsw-alias-label-primary-foreground);\r\n}\r\n\r\n.dun7765_primaryButton:hover:not(:disabled) {\r\n  background: var(--dsw-alias-button-primary-hover);\r\n}\r\n\r\n.dun7765_secondaryButton,\r\n.dun7765_addBlockButton {\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  background: transparent;\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.dun7765_secondaryButton:hover:not(:disabled),\r\n.dun7765_addBlockButton:hover:not(:disabled) {\r\n  background: var(--dsw-alias-interactive-bg-hover-solid);\r\n}\r\n\r\n.dun7765_dangerButton {\r\n  background: transparent;\r\n  color: var(--dsw-alias-state-error-primary);\r\n}\r\n\r\n.dun7765_dangerButton:hover:not(:disabled) {\r\n  background: var(--dsw-alias-interactive-bg-hover-danger);\r\n}\r\n\r\n/* Row-context buttons go dense (h28 r14, 12/18). */\r\n.dun7765_rowActions .dun7765_secondaryButton,\r\n.dun7765_rowActions .dun7765_dangerButton {\r\n  height: 28px;\r\n  padding: 0 10px;\r\n  border-radius: 14px;\r\n  font-size: 12px;\r\n  line-height: 18px;\r\n}\r\n\r\n.dun7765_rowActions .dun7765_primaryButton {\r\n  height: 28px;\r\n  padding: 0 10px;\r\n  border-radius: 14px;\r\n  font-size: 12px;\r\n  line-height: 18px;\r\n}\r\n\r\n.dun7765_primaryButton:disabled,\r\n.dun7765_secondaryButton:disabled,\r\n.dun7765_dangerButton:disabled,\r\n.dun7765_addBlockButton:disabled {\r\n  opacity: 0.4;\r\n  cursor: default;\r\n}\r\n\r\n.dun7765_primaryButton:focus-visible,\r\n.dun7765_secondaryButton:focus-visible,\r\n.dun7765_dangerButton:focus-visible,\r\n.dun7765_addBlockButton:focus-visible {\r\n  outline: none;\r\n  box-shadow: 0 0 0 2px var(--dsw-alias-border-l3);\r\n}\r\n\r\n/* Add-profile action: a full-width dashed-outline place card matching\r\n * ModelsSection's addBlock — not a command pill. Clicking it reveals the\r\n * inline draft card (handled in JS); the button itself is the affordance. */\r\n.dun7765_addBlockButton {\r\n  width: 100%;\r\n  margin-top: 12px;\r\n  border-style: dashed;\r\n  border-radius: 12px;\r\n  height: 40px;\r\n  color: var(--dsw-alias-label-secondary);\r\n}\r\n\r\n.dun7765_addBlockButton:hover:not(:disabled) {\r\n  color: var(--dsw-alias-label-primary);\r\n  border-color: var(--dsw-alias-brand-primary);\r\n}\r\n\r\n/* Empty state. */\r\n.dun7765_empty {\r\n  margin: 0;\r\n  padding: 24px 12px;\r\n  text-align: center;\r\n  font-size: 14px;\r\n  line-height: 22px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n}\r\n\r\n/* Modal confirm body text. */\r\n.dun7765_confirmText {\r\n  margin: 0;\r\n  font-size: 14px;\r\n  line-height: 22px;\r\n  color: var(--dsw-alias-label-secondary);\r\n}\r\n\r\n/* Repair history block: a discrete action below the add-profile button. */\r\n.dun7765_repairBlock {\r\n  margin-top: 8px;\r\n}\r\n\r\n.dun7765_repairBlock button {\r\n  width: 100%;\r\n}\r\n\r\n/* Repair result stats container. */\r\n.dun7765_repairStats {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 4px;\r\n}\r\n\r\n/* Repair error list inside the result modal. */\r\n.dun7765_repairErrorList {\r\n  margin: 8px 0 0;\r\n  padding: 0 0 0 16px;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 4px;\r\n  max-height: 200px;\r\n  overflow-y: auto;\r\n}\r\n\r\n.dun7765_loading {\r\n  padding: 12px;\r\n  font-size: 14px;\r\n  line-height: 22px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n}\r\n\r\n/* ─── Multi-select dropdown ─────────────────────────────────────────────── */\r\n\r\n.dun7765_multiSelect {\r\n  position: relative;\r\n  width: 100%;\r\n}\r\n\r\n.dun7765_msButton {\r\n  box-sizing: border-box;\r\n  width: 100%;\r\n  height: 32px;\r\n  padding: 0 10px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 8px;\r\n  font: inherit;\r\n  font-size: 14px;\r\n  line-height: 22px;\r\n  background: var(--dsw-alias-bg-layer-1);\r\n  color: var(--dsw-alias-label-primary);\r\n  cursor: pointer;\r\n  display: inline-flex;\r\n  align-items: center;\r\n  justify-content: space-between;\r\n  gap: 8px;\r\n}\r\n\r\n.dun7765_msButton:hover {\r\n  border-color: var(--dsw-alias-brand-primary);\r\n}\r\n\r\n.dun7765_msButton:focus-visible {\r\n  outline: none;\r\n  border-color: var(--dsw-alias-brand-primary);\r\n  box-shadow: 0 0 0 2px var(--dsw-alias-border-l3);\r\n}\r\n\r\n.dun7765_msButtonLabel {\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n  flex: 1 1 auto;\r\n  text-align: left;\r\n}\r\n\r\n/* Caret: DSH IconChevronDownOutline14 icon. */\r\n.dun7765_msCaret {\r\n  flex: none;\r\n  opacity: 0.6;\r\n}\r\n\r\n.dun7765_msPopup {\r\n  position: absolute;\r\n  top: calc(100% + 4px);\r\n  left: 0;\r\n  right: 0;\r\n  z-index: 10;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 8px;\r\n  background: var(--dsw-alias-bg-layer-1);\r\n  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);\r\n  display: flex;\r\n  flex-direction: column;\r\n  max-height: 280px;\r\n  overflow: hidden;\r\n}\r\n\r\n.dun7765_msSearch {\r\n  box-sizing: border-box;\r\n  width: 100%;\r\n  padding: 8px 10px;\r\n  border: none;\r\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\r\n  font: inherit;\r\n  font-size: 14px;\r\n  line-height: 22px;\r\n  background: transparent;\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.dun7765_msSearch:focus {\r\n  outline: none;\r\n}\r\n\r\n.dun7765_msSearch::placeholder {\r\n  color: var(--dsw-alias-label-dimmed);\r\n}\r\n\r\n.dun7765_msActions {\r\n  display: flex;\r\n  justify-content: flex-end;\r\n  padding: 6px 10px;\r\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\r\n}\r\n\r\n.dun7765_msActionLink {\r\n  border: none;\r\n  background: transparent;\r\n  color: var(--dsw-alias-brand-primary);\r\n  font: inherit;\r\n  font-size: 12px;\r\n  line-height: 18px;\r\n  cursor: pointer;\r\n  padding: 0;\r\n}\r\n\r\n.dun7765_msActionLink:hover {\r\n  text-decoration: underline;\r\n}\r\n\r\n.dun7765_msList {\r\n  list-style: none;\r\n  margin: 0;\r\n  padding: 4px 0;\r\n  overflow-y: auto;\r\n  flex: 1 1 auto;\r\n}\r\n\r\n.dun7765_msItem {\r\n  margin: 0;\r\n}\r\n\r\n.dun7765_msItemLabel {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n  padding: 6px 10px;\r\n  cursor: pointer;\r\n  font-size: 13px;\r\n  line-height: 18px;\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.dun7765_msItemLabel:hover {\r\n  background: var(--dsw-alias-interactive-bg-hover-solid);\r\n}\r\n\r\n.dun7765_msItemLabel input[type='checkbox'] {\r\n  margin: 0;\r\n  cursor: pointer;\r\n  flex: none;\r\n}\r\n\r\n.dun7765_msItemName {\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n  font-family: var(--dsw-font-markdown-code-block-small, monospace);\r\n}\r\n\r\n.dun7765_msEmpty {\r\n  padding: 12px 10px;\r\n  font-size: 13px;\r\n  line-height: 18px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  text-align: center;\r\n}\r\n";
		const classMap = {
			"section": "dun7765_section",
			"title": "dun7765_title",
			"intro": "dun7765_intro",
			"error": "dun7765_error",
			"errorDismiss": "dun7765_errorDismiss",
			"rows": "dun7765_rows",
			"rowCard": "dun7765_rowCard",
			"rowHead": "dun7765_rowHead",
			"chevronButton": "dun7765_chevronButton",
			"g": "dun7765_g",
			"chevronSpacer": "dun7765_chevronSpacer",
			"chevron": "dun7765_chevron",
			"chevronExpanded": "dun7765_chevronExpanded",
			"rowIdentity": "dun7765_rowIdentity",
			"rowName": "dun7765_rowName",
			"rowNamePlaceholder": "dun7765_rowNamePlaceholder",
			"builtinBadge": "dun7765_builtinBadge",
			"rowId": "dun7765_rowId",
			"rowActions": "dun7765_rowActions",
			"editor": "dun7765_editor",
			"field": "dun7765_field",
			"fieldLabel": "dun7765_fieldLabel",
			"fieldControl": "dun7765_fieldControl",
			"input": "dun7765_input",
			"dropdownButton": "dun7765_dropdownButton",
			"dropdownButtonLabel": "dun7765_dropdownButtonLabel",
			"dropdownCaret": "dun7765_dropdownCaret",
			"textarea": "dun7765_textarea",
			"kind": "dun7765_kind",
			"radioGroup": "dun7765_radioGroup",
			"radioOption": "dun7765_radioOption",
			"primaryButton": "dun7765_primaryButton",
			"secondaryButton": "dun7765_secondaryButton",
			"dangerButton": "dun7765_dangerButton",
			"addBlockButton": "dun7765_addBlockButton",
			"empty": "dun7765_empty",
			"confirmText": "dun7765_confirmText",
			"repairBlock": "dun7765_repairBlock",
			"repairStats": "dun7765_repairStats",
			"repairErrorList": "dun7765_repairErrorList",
			"loading": "dun7765_loading",
			"multiSelect": "dun7765_multiSelect",
			"msButton": "dun7765_msButton",
			"msButtonLabel": "dun7765_msButtonLabel",
			"msCaret": "dun7765_msCaret",
			"msPopup": "dun7765_msPopup",
			"msSearch": "dun7765_msSearch",
			"msActions": "dun7765_msActions",
			"msActionLink": "dun7765_msActionLink",
			"msList": "dun7765_msList",
			"msItem": "dun7765_msItem",
			"msItemLabel": "dun7765_msItemLabel",
			"msItemName": "dun7765_msItemName",
			"msEmpty": "dun7765_msEmpty"
		};
		const tagId = "@huanlin/dsh-plugin-yet-another-subagent/SettingsPage.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@huanlin/dsh-plugin-yet-another-subagent";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region src/client/SettingsPage.tsx
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
		* deny is picked, populated from `tools.list` (the host's current
		* `ctx.tools.schemas()`).
		*
		* Pulls the profile list once on mount via `connection.rpc.call('/ya-subagent',
		* 'profiles.list')`, dispatches add/update/remove through the
		* same RPC. The toolview slot is keyed by `subagent` and registered once at
		* plugin load, so profile mutations do not need to re-register slots.
		*
		* @module @huanlin/dsh-plugin-yet-another-subagent/client/SettingsPage
		*/
		/** Default shape for a brand-new draft (before the user fills in id/label). */
		function emptyDraft() {
			return {
				id: "",
				label: "",
				model: {
					kind: "auto",
					provider: "",
					model: ""
				},
				persona: { kind: "inherit" },
				toolFilter: { kind: "none" },
				maxDepth: 3,
				backgroundMode: "continuable",
				builtin: false
			};
		}
		async function callRpc(rpc, endpoint, payload) {
			return rpc.call("/ya-subagent", endpoint, payload);
		}
		/**
		* Render the subagent profiles settings page.
		* @param props - settings.section runtime share + locale + inject.
		* @returns the page element.
		*/
		function SettingsPage({ rpc, fetchProfiles, t }) {
			const [profiles, setProfiles] = (0, react.useState)([]);
			const [drafts, setDrafts] = (0, react.useState)([]);
			const [expanded, setExpanded] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [addingNew, setAddingNew] = (0, react.useState)(false);
			const [newDraft, setNewDraft] = (0, react.useState)(emptyDraft());
			const [toolList, setToolList] = (0, react.useState)([]);
			const [modelGroups, setModelGroups] = (0, react.useState)([]);
			const [loading, setLoading] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(void 0);
			const [confirmDelete, setConfirmDelete] = (0, react.useState)(void 0);
			const [repairConfirmOpen, setRepairConfirmOpen] = (0, react.useState)(false);
			const [repairRunning, setRepairRunning] = (0, react.useState)(false);
			const [repairStats, setRepairStats] = (0, react.useState)(void 0);
			const [repairError, setRepairError] = (0, react.useState)(void 0);
			const refresh = (0, react.useCallback)(async () => {
				setLoading(true);
				setError(void 0);
				try {
					const [list, toolsResult, modelsResult] = await Promise.all([
						fetchProfiles(),
						callRpc(rpc, "tools.list", {}),
						rpc.call("/api", "llm.models", {})
					]);
					setProfiles(list);
					setDrafts(list.map((p) => ({ ...p })));
					if (toolsResult.ok) setToolList(toolsResult.value.tools);
					else setToolList([]);
					if (modelsResult.ok) setModelGroups(modelsResult.value.groups);
					else setModelGroups([]);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setLoading(false);
				}
			}, [fetchProfiles, rpc]);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			const addProfile = (0, react.useCallback)(async () => {
				if (newDraft.id === "" || newDraft.label === "") return;
				const result = await callRpc(rpc, "profiles.add", { profile: newDraft });
				if (result.ok) {
					setProfiles(result.value.profiles);
					setDrafts(result.value.profiles.map((p) => ({ ...p })));
					setExpanded(/* @__PURE__ */ new Set([...expanded, newDraft.id]));
					setAddingNew(false);
					setNewDraft(emptyDraft());
				} else setError(result.error.message);
			}, [
				expanded,
				newDraft,
				rpc
			]);
			const updateProfile = (0, react.useCallback)(async (draft) => {
				const result = await callRpc(rpc, "profiles.update", { profile: draft });
				if (result.ok) {
					setProfiles(result.value.profiles);
					setDrafts(result.value.profiles.map((p) => ({ ...p })));
				} else setError(result.error.message);
			}, [rpc]);
			const removeProfile = (0, react.useCallback)(async (id) => {
				const result = await callRpc(rpc, "profiles.remove", { id });
				if (result.ok) {
					setProfiles(result.value.profiles);
					setDrafts(result.value.profiles.map((p) => ({ ...p })));
					const next = new Set(expanded);
					next.delete(id);
					setExpanded(next);
				} else setError(result.error.message);
			}, [expanded, rpc]);
			const runRepair = (0, react.useCallback)(async () => {
				setRepairConfirmOpen(false);
				setRepairRunning(true);
				setRepairError(void 0);
				try {
					const result = await callRpc(rpc, "sessions.repair", {});
					if (result.ok) setRepairStats(result.value);
					else setRepairError(result.error.message);
				} catch (err) {
					setRepairError(err instanceof Error ? err.message : String(err));
				} finally {
					setRepairRunning(false);
				}
			}, [rpc]);
			const patchDraft = (id, patch) => {
				setDrafts((prev) => prev.map((d) => d.id === id ? {
					...d,
					...patch
				} : d));
			};
			const toggleExpand = (id) => {
				const next = new Set(expanded);
				if (next.has(id)) next.delete(id);
				else next.add(id);
				setExpanded(next);
			};
			const cancelNew = () => {
				setAddingNew(false);
				setNewDraft(emptyDraft());
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: classMap.section,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: classMap.title,
						children: t("page.title")
					}),
					error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: classMap.error,
						children: [error, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: classMap.errorDismiss,
							onClick: () => setError(void 0),
							children: "×"
						})]
					}),
					loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: classMap.loading,
						children: "…"
					}) : profiles.length === 0 && !addingNew ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: classMap.empty,
						children: t("page.empty")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("ul", {
						className: classMap.rows,
						children: [drafts.map((draft) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProfileCard, {
							draft,
							expanded: expanded.has(draft.id),
							toolList,
							modelGroups,
							t,
							onToggle: () => toggleExpand(draft.id),
							onPatch: (patch) => patchDraft(draft.id, patch),
							onSave: () => void updateProfile(draft),
							onDelete: () => setConfirmDelete(draft.id)
						}, draft.id)), addingNew && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProfileCard, {
							draft: newDraft,
							expanded: true,
							isNew: true,
							toolList,
							modelGroups,
							t,
							onPatch: (patch) => setNewDraft((prev) => ({
								...prev,
								...patch
							})),
							onCreate: () => void addProfile(),
							onCancel: cancelNew
						}, "__new__")]
					}),
					!loading && !addingNew && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: classMap.addBlockButton,
						onClick: () => setAddingNew(true),
						children: t("page.add")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: classMap.repairBlock,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: classMap.secondaryButton,
							disabled: repairRunning,
							onClick: () => setRepairConfirmOpen(true),
							children: repairRunning ? t("repair.running") : t("repair.button")
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: repairConfirmOpen,
						onClose: () => {
							setRepairConfirmOpen(false);
						},
						title: t("repair.confirm.title"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: classMap.secondaryButton,
							onClick: () => {
								setRepairConfirmOpen(false);
							},
							children: t("repair.confirm.cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: classMap.primaryButton,
							onClick: () => {
								runRepair();
							},
							children: t("repair.confirm.proceed")
						})] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: classMap.confirmText,
							children: t("repair.confirm.body")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: classMap.confirmText,
							children: t("repair.confirm.warning")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: repairStats !== void 0 || repairError !== void 0,
						onClose: () => {
							setRepairStats(void 0);
							setRepairError(void 0);
						},
						title: t("repair.result.title"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: classMap.secondaryButton,
							onClick: () => {
								setRepairStats(void 0);
								setRepairError(void 0);
							},
							children: t("repair.result.close")
						}),
						children: repairError !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							className: classMap.error,
							children: [
								t("repair.error"),
								": ",
								repairError
							]
						}) : repairStats !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: classMap.repairStats,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: classMap.confirmText,
									children: t("repair.result.scanned").replace("{n}", String(repairStats.scanned))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: classMap.confirmText,
									children: t("repair.result.repaired").replace("{n}", String(repairStats.repaired))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: classMap.confirmText,
									children: t("repair.result.skipped").replace("{n}", String(repairStats.skipped))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: classMap.confirmText,
									children: t("repair.result.errors").replace("{n}", String(repairStats.errors.length))
								}),
								repairStats.errors.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: classMap.repairErrorList,
									children: repairStats.errors.map((e, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
										className: classMap.confirmText,
										children: t("repair.result.errorEntry").replace("{path}", e.path).replace("{message}", e.message)
									}, i))
								})
							]
						}) : null
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: confirmDelete !== void 0,
						onClose: () => {
							setConfirmDelete(void 0);
						},
						title: t("row.delete.confirm"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: classMap.secondaryButton,
							onClick: () => {
								setConfirmDelete(void 0);
							},
							children: t("page.add.cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: classMap.dangerButton,
							onClick: () => {
								if (confirmDelete !== void 0) removeProfile(confirmDelete);
								setConfirmDelete(void 0);
							},
							children: t("row.delete")
						})] }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: classMap.confirmText,
							children: t("row.delete.confirm")
						})
					})
				]
			});
		}
		function ProfileCard({ draft, expanded, isNew, toolList, modelGroups, t, onToggle, onPatch, onSave, onDelete, onCreate, onCancel }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: classMap.rowCard,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: classMap.rowHead,
					children: [
						!isNew && onToggle !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: classMap.chevronButton,
							onClick: onToggle,
							"aria-label": expanded ? t("row.collapse") : t("row.expand"),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: expanded ? `${classMap.chevron} ${classMap.chevronExpanded}` : classMap.chevron,
								"aria-hidden": "true"
							})
						}),
						isNew && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: classMap.chevronSpacer,
							"aria-hidden": "true"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: classMap.rowIdentity,
							children: [
								isNew ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: classMap.rowNamePlaceholder,
									children: t("page.add")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: classMap.rowName,
									children: draft.label === "" ? draft.id : draft.label
								}),
								draft.builtin && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
									className: classMap.builtinBadge,
									children: t("badge.builtin")
								}),
								!isNew && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
									className: classMap.rowId,
									children: draft.id
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: classMap.rowActions,
							children: isNew ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: classMap.primaryButton,
								onClick: onCreate,
								disabled: draft.id === "" || draft.label === "",
								children: t("page.add.submit")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: classMap.secondaryButton,
								onClick: onCancel,
								children: t("page.add.cancel")
							})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: classMap.secondaryButton,
								onClick: onSave,
								children: t("row.save")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: classMap.dangerButton,
								onClick: onDelete,
								children: t("row.delete")
							})] })
						})
					]
				}), expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: classMap.editor,
					children: [
						isNew && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: classMap.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: classMap.fieldLabel,
								children: t("row.id")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: classMap.input,
								value: draft.id,
								placeholder: t("page.add.placeholder.id"),
								onChange: (e) => onPatch({ id: e.target.value })
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: classMap.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: classMap.fieldLabel,
								children: t("row.label")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: classMap.input,
								value: draft.label,
								placeholder: t("page.add.placeholder.label"),
								onChange: (e) => onPatch({ label: e.target.value })
							})]
						})] }),
						!isNew && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: classMap.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: classMap.fieldLabel,
								children: t("row.label")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: classMap.input,
								value: draft.label,
								onChange: (e) => onPatch({ label: e.target.value })
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: classMap.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: classMap.fieldLabel,
								children: [
									t("row.model.kind.auto"),
									" / ",
									t("row.model.kind.manual")
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: classMap.radioGroup,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: classMap.radioOption,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "radio",
										name: `model-${draft.id}-${isNew ? "new" : ""}`,
										checked: draft.model.kind === "auto",
										onChange: () => onPatch({ model: {
											kind: "auto",
											provider: "",
											model: ""
										} })
									}), t("row.model.kind.auto")]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: classMap.radioOption,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "radio",
										name: `model-${draft.id}-${isNew ? "new" : ""}`,
										checked: draft.model.kind === "manual",
										onChange: () => onPatch({ model: {
											kind: "manual",
											provider: draft.model.provider,
											model: draft.model.model
										} })
									}), t("row.model.kind.manual")]
								})]
							})]
						}),
						draft.model.kind === "manual" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: classMap.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: classMap.fieldLabel,
								children: t("row.model.provider")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DropdownPicker, {
								value: draft.model.provider,
								placeholder: t("row.model.provider.placeholder"),
								items: modelGroups.map((g) => ({
									id: g.id,
									label: g.name
								})),
								onSelect: (id) => onPatch({ model: {
									kind: "manual",
									provider: id,
									model: ""
								} })
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: classMap.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: classMap.fieldLabel,
								children: t("row.model.model")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DropdownPicker, {
								value: draft.model.model,
								placeholder: t("row.model.model.placeholder"),
								disabled: draft.model.provider === "",
								items: draft.model.provider !== "" ? modelGroups.filter((g) => g.id === draft.model.provider).flatMap((g) => g.models).map((m) => ({
									id: m.id,
									label: m.name
								})) : [],
								onSelect: (id) => onPatch({ model: {
									kind: "manual",
									provider: draft.model.provider,
									model: id
								} })
							})]
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: classMap.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: classMap.fieldLabel,
								children: t("row.persona")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: classMap.radioGroup,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: classMap.radioOption,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "radio",
										name: `persona-${draft.id}-${isNew ? "new" : ""}`,
										checked: draft.persona.kind === "inherit",
										onChange: () => onPatch({ persona: { kind: "inherit" } })
									}), t("row.persona.kind.inherit")]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: classMap.radioOption,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "radio",
										name: `persona-${draft.id}-${isNew ? "new" : ""}`,
										checked: draft.persona.kind === "custom",
										onChange: () => onPatch({ persona: {
											kind: "custom",
											text: draft.persona.kind === "custom" ? draft.persona.text : ""
										} })
									}), t("row.persona.kind.custom")]
								})]
							})]
						}),
						draft.persona.kind === "custom" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: classMap.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: classMap.fieldLabel,
								children: t("row.persona.text")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								className: classMap.textarea,
								value: draft.persona.kind === "custom" ? draft.persona.text : "",
								onChange: (e) => onPatch({ persona: {
									kind: "custom",
									text: e.target.value
								} })
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: classMap.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: classMap.fieldLabel,
								children: t("row.toolFilter")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: classMap.radioGroup,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: classMap.radioOption,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: `toolFilter-${draft.id}-${isNew ? "new" : ""}`,
											checked: draft.toolFilter.kind === "none",
											onChange: () => onPatch({ toolFilter: { kind: "none" } })
										}), t("row.toolFilter.kind.none")]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: classMap.radioOption,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: `toolFilter-${draft.id}-${isNew ? "new" : ""}`,
											checked: draft.toolFilter.kind === "allow",
											onChange: () => onPatch({ toolFilter: {
												kind: "allow",
												tools: draft.toolFilter.kind === "allow" ? draft.toolFilter.tools : []
											} })
										}), t("row.toolFilter.kind.allow")]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: classMap.radioOption,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: `toolFilter-${draft.id}-${isNew ? "new" : ""}`,
											checked: draft.toolFilter.kind === "deny",
											onChange: () => onPatch({ toolFilter: {
												kind: "deny",
												tools: draft.toolFilter.kind === "deny" ? draft.toolFilter.tools : []
											} })
										}), t("row.toolFilter.kind.deny")]
									})
								]
							})]
						}),
						(draft.toolFilter.kind === "allow" || draft.toolFilter.kind === "deny") && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: classMap.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: classMap.fieldLabel,
								children: t("row.toolFilter.tools")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MultiSelect, {
								options: toolList,
								value: draft.toolFilter.kind === "allow" || draft.toolFilter.kind === "deny" ? [...draft.toolFilter.tools] : [],
								onChange: (next) => onPatch({ toolFilter: {
									kind: draft.toolFilter.kind === "deny" ? "deny" : "allow",
									tools: next
								} }),
								t
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: classMap.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: classMap.fieldLabel,
								children: t("row.maxDepth")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "number",
								min: 0,
								className: classMap.input,
								value: draft.maxDepth,
								onChange: (e) => onPatch({ maxDepth: Number(e.target.value) })
							})]
						})
					]
				})]
			});
		}
		function MultiSelect({ options, value, onChange, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			const [query, setQuery] = (0, react.useState)("");
			const containerRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (!open) return;
				const handler = (e) => {
					if (containerRef.current !== null && !containerRef.current.contains(e.target)) setOpen(false);
				};
				document.addEventListener("mousedown", handler);
				return () => document.removeEventListener("mousedown", handler);
			}, [open]);
			const q = query.trim().toLowerCase();
			const filtered = q === "" ? options : options.filter((o) => o.name.toLowerCase().includes(q));
			const valueSet = new Set(value);
			const filteredAllSelected = filtered.length > 0 && filtered.every((o) => valueSet.has(o.name));
			const selectAllFiltered = () => {
				if (filteredAllSelected) onChange(value.filter((n) => !filtered.some((o) => o.name === n)));
				else {
					const next = new Set(value);
					for (const o of filtered) next.add(o.name);
					onChange([...next]);
				}
			};
			const toggleOne = (name) => {
				if (valueSet.has(name)) onChange(value.filter((n) => n !== name));
				else onChange([...value, name]);
			};
			const label = value.length === 0 ? t("row.toolFilter.tools") : t("row.toolFilter.tools.selected").replace("{n}", String(value.length));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: classMap.multiSelect,
				ref: containerRef,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: classMap.msButton,
					onClick: () => setOpen((prev) => !prev),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: classMap.msButtonLabel,
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { className: classMap.msCaret })]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: classMap.msPopup,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: classMap.msSearch,
							placeholder: t("row.toolFilter.tools.search"),
							value: query,
							onChange: (e) => setQuery(e.target.value)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: classMap.msActions,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: classMap.msActionLink,
								onClick: selectAllFiltered,
								children: filteredAllSelected ? t("row.toolFilter.tools.clear") : t("row.toolFilter.tools.selectAll")
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: classMap.msList,
							children: filtered.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
								className: classMap.msEmpty,
								children: t("row.toolFilter.tools.empty")
							}) : filtered.map((o) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
								className: classMap.msItem,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: classMap.msItemLabel,
									title: o.description,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: valueSet.has(o.name),
										onChange: () => toggleOne(o.name)
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: classMap.msItemName,
										children: o.name
									})]
								})
							}, o.name))
						})
					]
				})]
			});
		}
		function DropdownPicker({ value, placeholder, items, disabled, onSelect }) {
			const [open, setOpen] = (0, react.useState)(false);
			const selectedLabel = items.find((i) => i.id === value)?.label;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				open: open && disabled !== true,
				onClose: () => {
					setOpen(false);
				},
				items,
				selectedId: value === "" ? void 0 : value,
				onSelect: (id) => {
					onSelect(id);
					setOpen(false);
				},
				align: "start",
				portal: true,
				anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: classMap.dropdownButton,
					disabled,
					"aria-haspopup": "menu",
					"aria-expanded": open,
					onClick: () => {
						setOpen((v) => !v);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: classMap.dropdownButtonLabel,
						children: selectedLabel ?? placeholder
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { className: classMap.dropdownCaret })]
				})
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** Locale namespace id. */
		const NS = "ya-subagent";
		/** English dictionary. */
		const en = {
			"nav": "Subagents",
			"page.title": "Subagent Profiles",
			"page.empty": "No profiles configured. Add one below.",
			"page.add": "+ Add subagent",
			"page.add.placeholder.id": "profile-id",
			"page.add.placeholder.label": "Display name",
			"page.add.submit": "Create",
			"page.add.error": "Failed to add profile",
			"page.add.cancel": "Cancel",
			"row.label": "Label",
			"row.id": "ID",
			"row.model.kind.auto": "Auto (inherit parent model)",
			"row.model.kind.manual": "Manual",
			"row.model.provider": "Provider",
			"row.model.model": "Model",
			"row.model.provider.placeholder": "Select provider…",
			"row.model.model.placeholder": "Select model…",
			"row.model.noModels": "No models available",
			"row.persona": "Persona",
			"row.persona.kind.inherit": "Inherit (default persona)",
			"row.persona.kind.custom": "Custom",
			"row.persona.text": "Custom persona text",
			"row.toolFilter": "Tools",
			"row.toolFilter.kind.none": "No restriction",
			"row.toolFilter.kind.allow": "Whitelist",
			"row.toolFilter.kind.deny": "Blacklist",
			"row.toolFilter.tools": "Tools",
			"row.toolFilter.tools.search": "Search tools…",
			"row.toolFilter.tools.empty": "No tools found",
			"row.toolFilter.tools.selected": "{n} selected",
			"row.toolFilter.tools.selectAll": "Select all",
			"row.toolFilter.tools.clear": "Clear",
			"row.maxDepth": "Max depth",
			"row.delete": "Delete",
			"row.delete.confirm": "Delete this profile?",
			"row.save": "Save",
			"row.saved": "Saved",
			"row.error": "Failed to update profile",
			"row.expand": "Expand",
			"row.collapse": "Collapse",
			"badge.builtin": "builtin",
			"card.starting": "Starting…",
			"card.waiting": "Waiting for child session…",
			"card.idle": "idle",
			"card.running": "running",
			"card.completed": "completed",
			"card.child-running": "running",
			"card.child-idle": "idle",
			"card.toolcalls": "tool calls",
			"card.tokens": "Tokens",
			"card.calling": "calling",
			"card.open": "Click to open subagent session →",
			"card.unavailable": "session unavailable",
			"tree.tab": "Subagent Tree",
			"tree.empty": "No subagent children in this session.",
			"tree.rootHint": "Showing the root session’s subagent tree.",
			"tree.toolcalls": "tool calls",
			"tree.tokens": "Tokens",
			"tree.calling": "calling",
			"tree.state.running": "running",
			"tree.state.idle": "idle",
			"tree.state.settled": "settled",
			"repair.button": "Repair session history",
			"repair.confirm.title": "Repair session history?",
			"repair.confirm.body": "Scans every session log under $DSH_HOME/sessions and stamps \"ignorable\" on legacy ya-subagent/started events so the harness can load them again. Each modified file is backed up to .bak first.",
			"repair.confirm.warning": "If dsh is running, a session being written right now may conflict; prefer running this when no agent is active.",
			"repair.confirm.cancel": "Cancel",
			"repair.confirm.proceed": "Repair",
			"repair.running": "Repairing…",
			"repair.result.title": "Repair complete",
			"repair.result.scanned": "Scanned: {n}",
			"repair.result.repaired": "Repaired: {n}",
			"repair.result.skipped": "Skipped (already clean): {n}",
			"repair.result.errors": "Errors: {n}",
			"repair.result.errorEntry": "{path}: {message}",
			"repair.result.close": "Close",
			"repair.error": "Repair failed"
		};
		/** Chinese dictionary. */
		const zh = {
			"nav": "子代理",
			"page.title": "子代理配置",
			"page.empty": "暂无配置，请在下方添加。",
			"page.add": "+ 添加子代理",
			"page.add.placeholder.id": "profile-id",
			"page.add.placeholder.label": "显示名",
			"page.add.submit": "创建",
			"page.add.error": "添加失败",
			"page.add.cancel": "取消",
			"row.label": "名称",
			"row.id": "ID",
			"row.model.kind.auto": "自动（继承父代理模型）",
			"row.model.kind.manual": "手动指定",
			"row.model.provider": "Provider",
			"row.model.model": "模型",
			"row.model.provider.placeholder": "选择 Provider…",
			"row.model.model.placeholder": "选择模型…",
			"row.model.noModels": "无可用模型",
			"row.persona": "人设",
			"row.persona.kind.inherit": "跟随默认人设",
			"row.persona.kind.custom": "自定义",
			"row.persona.text": "自定义人设文本",
			"row.toolFilter": "工具",
			"row.toolFilter.kind.none": "不管",
			"row.toolFilter.kind.allow": "白名单",
			"row.toolFilter.kind.deny": "黑名单",
			"row.toolFilter.tools": "工具列表",
			"row.toolFilter.tools.search": "搜索工具…",
			"row.toolFilter.tools.empty": "未找到工具",
			"row.toolFilter.tools.selected": "已选 {n} 个",
			"row.toolFilter.tools.selectAll": "全选",
			"row.toolFilter.tools.clear": "清空",
			"row.maxDepth": "最大递归深度",
			"row.delete": "删除",
			"row.delete.confirm": "确定删除此配置？",
			"row.save": "保存",
			"row.saved": "已保存",
			"row.error": "保存失败",
			"row.expand": "展开",
			"row.collapse": "收起",
			"badge.builtin": "内置",
			"card.starting": "启动中…",
			"card.waiting": "等待子会话…",
			"card.idle": "空闲",
			"card.running": "运行中",
			"card.completed": "已完成",
			"card.child-running": "运行中",
			"card.child-idle": "空闲",
			"card.toolcalls": "次工具调用",
			"card.tokens": "Tokens",
			"card.calling": "调用中",
			"card.open": "点击打开子代理会话 →",
			"card.unavailable": "会话不可用",
			"tree.tab": "子代理树",
			"tree.empty": "当前会话暂无子代理。",
			"tree.rootHint": "显示根会话的子代理树。",
			"tree.toolcalls": "次工具调用",
			"tree.tokens": "Tokens",
			"tree.calling": "调用中",
			"tree.state.running": "运行中",
			"tree.state.idle": "空闲",
			"tree.state.settled": "已结束",
			"repair.button": "修复历史会话",
			"repair.confirm.title": "修复历史会话？",
			"repair.confirm.body": "将扫描 $DSH_HOME/sessions 下的所有会话日志，为遗留的 ya-subagent/started 事件补上 \"ignorable\" 标记，使 harness 能重新加载。每个被修改的文件会先备份为 .bak。",
			"repair.confirm.warning": "若 dsh 正在运行，正在写入的会话可能冲突；建议在无活跃代理时执行。",
			"repair.confirm.cancel": "取消",
			"repair.confirm.proceed": "修复",
			"repair.running": "修复中…",
			"repair.result.title": "修复完成",
			"repair.result.scanned": "扫描：{n}",
			"repair.result.repaired": "已修复：{n}",
			"repair.result.skipped": "跳过（已干净）：{n}",
			"repair.result.errors": "错误：{n}",
			"repair.result.errorEntry": "{path}：{message}",
			"repair.result.close": "关闭",
			"repair.error": "修复失败"
		};
		//#endregion
		//#region src/client/index.ts
		/** Required services: settings/tool slots, locale, sessions, connection. */
		const inject = [
			"slots",
			"locale",
			"sessions",
			"connection"
		];
		/**
		* Client plugin body: register settings page + single `subagent` toolview slot.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ya-subagent: dictionaries");
			const connection = ctx.connection;
			const t = ctx.locale.bind(NS);
			const profileLabels = /* @__PURE__ */ new Map();
			const refreshProfileLabels = (profiles) => {
				profileLabels.clear();
				for (const p of profiles) profileLabels.set(p.id, p.label);
			};
			const fetchProfilesInternal = async () => {
				const result = await connection.rpc.call("/ya-subagent", "profiles.list", {});
				return result.ok ? result.value.profiles : [];
			};
			fetchProfilesInternal().then(refreshProfileLabels).catch((error) => {
				ctx.logger.error("ya-subagent: initial profile label fetch failed", error);
			});
			ctx.on("connection/reset", () => {
				fetchProfilesInternal().then(refreshProfileLabels).catch((error) => {
					ctx.logger.error("ya-subagent: post-reset profile label fetch failed", error);
				});
			});
			const cardInjected = () => ({
				sessions: ctx.sessions,
				profileLabelOf: (id) => profileLabels.get(id)
			});
			ctx.effect(() => ctx.slots.register({
				name: "tool.call.toolview",
				key: "subagent",
				locale: NS,
				inject: cardInjected
			}, SubagentCard), "ya-subagent: subagent toolview");
			const fetchProfiles = fetchProfilesInternal;
			const settingsInjected = () => ({
				rpc: connection.rpc,
				fetchProfiles,
				t
			});
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "ya-subagent",
				order: 30,
				label: () => t("nav"),
				inject: settingsInjected
			}, SettingsPage));
			const treeInjected = () => ({
				sessions: ctx.sessions,
				profileLabelOf: (id) => profileLabels.get(id)
			});
			ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "subagent-tree",
				order: 20,
				label: () => ctx.locale.bind(NS)("tree.tab"),
				locale: NS,
				inject: treeInjected
			}, SubagentTreeView));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map