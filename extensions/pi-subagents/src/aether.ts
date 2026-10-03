/**
 * Aether Script Mod for pi-subagents.
 *
 * The Pi extension (src/index.ts) owns subagent execution and keeps running
 * inside Aether. Aether's TUI is absent there, so this mod re-homes the
 * TUI-facing parts on Aether Script API v2:
 *
 * - a native settings page that reads/writes the same .pi/subagents.json,
 * - a live "Agents" surface above the composer (widget + FleetView folded
 *   into tappable cards),
 * - an app.overlay conversation viewer with steering and stop controls,
 * - custom message renderers for background-completion notifications,
 * - semantic running/completed tool-card titles for Agent, get_subagent_result,
 *   and steer_subagent,
 * - a `before_send` hook that routes `@handle message` mentions through the
 *   Pi extension instead of sending them to the main model.
 *
 * The Pi extension installs a bridge handle on globalThis so this mod can
 * read live manager state and call manager controls without importing any
 * @earendil-works modules.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

type AetherJsonObject = Record<string, unknown>;
type AetherView = AetherJsonObject | AetherView[] | string | null | undefined;
type AetherRenderContext = AetherJsonObject & { storage: AetherJsonObject };
type AetherSettingDefinition = {
	id: string;
	label: string;
	description?: string;
	type?: "text" | "number" | "toggle" | "select" | "slider" | "password" | "textarea" | "button";
	default?: string | number | boolean;
	placeholder?: string;
	options?: Array<{ value: string; label: string }>;
	min?: number;
	max?: number;
	step?: number;
	action?: string;
	args?: AetherJsonObject;
	tone?: "primary" | "neutral" | "danger";
	icon?: string;
};
type AetherSettingsSection = {
	id?: string;
	title?: string;
	description?: string;
	settings: AetherSettingDefinition[];
};
type AetherMessageTypeDefinition = {
	type: string;
	title?: string;
	icon?: string;
	render: AetherView | ((context: AetherRenderContext & { message: AetherJsonObject }) => AetherView | Promise<AetherView>);
};
type AetherExtensionAPI = {
	ui: {
		node(type: string, properties?: AetherJsonObject, children?: AetherView[]): AetherJsonObject;
		text(text: string, properties?: AetherJsonObject): AetherJsonObject;
		code(text: string, properties?: AetherJsonObject): AetherJsonObject;
		column(children: AetherView[], properties?: AetherJsonObject): AetherJsonObject;
		row(children: AetherView[], properties?: AetherJsonObject): AetherJsonObject;
		card(children: AetherView[], properties?: AetherJsonObject): AetherJsonObject;
		button(label: string, action: string, properties?: AetherJsonObject): AetherJsonObject;
		input(value: string, action: string, properties?: AetherJsonObject): AetherJsonObject;
	};
	host: { invoke(method: string, args?: AetherJsonObject): Promise<AetherJsonObject> };
	storage: {
		get<T = unknown>(key: string, fallback?: T): T;
		set(key: string, value: unknown): void;
		delete(key: string): void;
		snapshot(): AetherJsonObject;
	};
	messages: { append(type: string, payload?: AetherJsonObject, text?: string): Promise<AetherJsonObject> };
	registerSettings(definition: {
		id: string;
		title: string;
		subtitle?: string;
		icon?: string;
		order?: number;
		sections?: AetherSettingsSection[];
		categories?: Array<{
			id: string;
			title: string;
			subtitle?: string;
			icon?: string;
			order?: number;
			sections: AetherSettingsSection[];
		}>;
	}): () => void;
	registerMessageType(definition: AetherMessageTypeDefinition): () => void;
	registerComposerMenuItem(definition: AetherJsonObject & { id: string; title: string }): () => void;
	registerSurface(slot: string, definition: AetherJsonObject & {
		render?: AetherView | ((context: AetherRenderContext) => AetherView | Promise<AetherView>);
	}): () => void;
	registerAction(id: string, handler: (payload: AetherJsonObject, context?: AetherRenderContext) => unknown | Promise<unknown>): () => void;
	registerToolTitle?(toolName: string, runningTitle: string, completedTitle: string, priority?: number): () => void;
	on?(event: string, handler: (payload: AetherJsonObject) => unknown | Promise<unknown>): () => void;
	invalidate(): void;
	notify(message: string, level?: "info" | "warning" | "error"): void;
};

// ---- Bridge to the Pi extension -------------------------------------------
// The Pi extension and this Script Mod are loaded by separate jiti loaders.
// globalThis + Symbol.for is the only reliable handoff between the two.

export type SubagentSnapshotAgent = {
	id: string;
	type: string;
	displayName: string;
	description: string;
	handle?: string;
	alias?: string;
	status: string;
	toolUses: number;
	tokens: string;
	turnCount: number;
	maxTurns?: number;
	durationMs: number;
	startedAt: number;
	completedAt?: number;
	activity: string;
	spinnerFrame: number;
	modelName: string;
	tags: string[];
	outputFile?: string;
	error?: string;
	resultPreview?: string;
	result?: string;
	isBackground?: boolean;
};

export type SubagentSnapshotType = {
	name: string;
	displayName: string;
	description: string;
	enabled: boolean;
	isDefault: boolean;
	source: "default" | "project" | "global";
};

export type SubagentsSnapshot = {
	agents: SubagentSnapshotAgent[];
	types: SubagentSnapshotType[];
	queued: number;
	running: number;
	settings: {
		maxConcurrent: number;
		defaultMaxTurns: number;
		graceTurns: number;
		maxSubagentDepth: number;
		defaultJoinMode: string;
		schedulingEnabled: boolean;
		scopeModels: boolean;
		strictAgentFiles: boolean;
		disableDefaultAgents: boolean;
		toolDescriptionMode: string;
		fleetView: boolean;
		agentMentions: string;
		rememberAgents: boolean;
		widgetMode: string;
		outputTranscript: boolean;
		fallbackSubagent?: string;
	};
};

export type MentionDispatchResult = {
	action: "continue" | "handled" | "transform";
	text?: string;
};

export type SubagentsPiBridge = {
	api?: AetherExtensionAPI;
	getSnapshot(): SubagentsSnapshot;
	getConversation(id: string): string | undefined;
	getResult(id: string): string | undefined;
	steer(id: string, message: string): boolean;
	abort(id: string): boolean;
	applySetting(id: string, value: unknown): { ok: boolean; message?: string };
	reloadAgents(): void;
	toggleAgent(name: string): { ok: boolean; message: string };
	dispatchMention(text: string): Promise<MentionDispatchResult>;
	onTypesChanged?: () => void;
};

const BRIDGE_KEY = Symbol.for("pi-subagents.aether-bridge");
const API_KEY = Symbol.for("pi-subagents.aether-api");

function readBridge(): SubagentsPiBridge | undefined {
	return (globalThis as Record<PropertyKey, unknown>)[BRIDGE_KEY] as SubagentsPiBridge | undefined;
}

type AetherBridgeState = {
	api: AetherExtensionAPI;
	onBridge?: (bridge: SubagentsPiBridge) => void;
};

function readAetherBridgeState(): AetherBridgeState | undefined {
	return (globalThis as Record<PropertyKey, unknown>)[API_KEY] as AetherBridgeState | undefined;
}

/** Installed by src/index.ts. Replacing is fine: there is one Pi activation. */
export function registerSubagentsBridge(bridge: SubagentsPiBridge): void {
	(globalThis as Record<PropertyKey, unknown>)[BRIDGE_KEY] = bridge;
	const state = readAetherBridgeState();
	if (!state) return;
	bridge.api = state.api;
	state.onBridge?.(bridge);
	state.api.invalidate?.();
}

/** Remove a bridge installed by this Pi activation during session shutdown. */
export function unregisterSubagentsBridge(bridge: SubagentsPiBridge): void {
	const current = readBridge();
	if (current !== bridge) return;
	delete (globalThis as Record<PropertyKey, unknown>)[BRIDGE_KEY];
}

/** Install or refresh the Aether API half of the bridge on Script Mod load. */
function attachAetherApi(api: AetherExtensionAPI, onBridge?: (bridge: SubagentsPiBridge) => void): void {
	(globalThis as Record<PropertyKey, unknown>)[API_KEY] = { api, onBridge };
	const bridge = readBridge();
	if (!bridge) return;
	bridge.api = api;
	onBridge?.(bridge);
	api.invalidate?.();
}


// ---- Pi settings file (mirrors src/settings.ts, without pi imports) --------

const SETTINGS_PAGE_ID = "subagents-settings";
const AGENTS_PAGE_ID = "subagents-agents";

type SettingValue = string | number | boolean;

const DEFAULTS = {
	maxConcurrent: 4,
	defaultMaxTurns: 0,
	graceTurns: 5,
	maxSubagentDepth: 2,
	defaultJoinMode: "smart",
	schedulingEnabled: true,
	scopeModels: false,
	strictAgentFiles: false,
	disableDefaultAgents: false,
	toolDescriptionMode: "full",
	fleetView: true,
	agentMentions: "model",
	rememberAgents: true,
	widgetMode: "background",
	outputTranscript: true,
} as const;

const VALID_JOIN_MODES = new Set(["async", "group", "smart"]);
const VALID_TOOL_DESCRIPTION_MODES = new Set(["full", "compact", "custom"]);
const VALID_WIDGET_MODES = new Set(["all", "background", "off"]);
const VALID_AGENT_MENTION_MODES = new Set(["model", "direct", "off"]);
const MAX_CONCURRENT_CEILING = 1024;
const MAX_TURNS_CEILING = 10_000;
const GRACE_TURNS_CEILING = 1_000;
const SUBAGENT_DEPTH_CEILING = 16;

function agentDir(): string {
	const env = process.env.PI_CODING_AGENT_DIR?.trim();
	if (env) return env;
	return join(homedir(), ".pi", "agent");
}

function globalSettingsPath(): string {
	return join(agentDir(), "subagents.json");
}

function projectSettingsPath(): string {
	return join(process.cwd(), ".pi", "subagents.json");
}

type RawSettings = Record<string, unknown>;

function sanitizeSettings(raw: unknown): RawSettings {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
	const r = raw as RawSettings;
	const out: RawSettings = {};
	if (Number.isInteger(r.maxConcurrent) && (r.maxConcurrent as number) >= 1 && (r.maxConcurrent as number) <= MAX_CONCURRENT_CEILING) {
		out.maxConcurrent = r.maxConcurrent;
	}
	if (Number.isInteger(r.defaultMaxTurns) && (r.defaultMaxTurns as number) >= 0 && (r.defaultMaxTurns as number) <= MAX_TURNS_CEILING) {
		out.defaultMaxTurns = r.defaultMaxTurns;
	}
	if (Number.isInteger(r.graceTurns) && (r.graceTurns as number) >= 1 && (r.graceTurns as number) <= GRACE_TURNS_CEILING) {
		out.graceTurns = r.graceTurns;
	}
	if (Number.isInteger(r.maxSubagentDepth) && (r.maxSubagentDepth as number) >= 0 && (r.maxSubagentDepth as number) <= SUBAGENT_DEPTH_CEILING) {
		out.maxSubagentDepth = r.maxSubagentDepth;
	}
	if (typeof r.defaultJoinMode === "string" && VALID_JOIN_MODES.has(r.defaultJoinMode)) {
		out.defaultJoinMode = r.defaultJoinMode;
	}
	if (typeof r.schedulingEnabled === "boolean") out.schedulingEnabled = r.schedulingEnabled;
	if (typeof r.scopeModels === "boolean") out.scopeModels = r.scopeModels;
	if (typeof r.strictAgentFiles === "boolean") out.strictAgentFiles = r.strictAgentFiles;
	if (typeof r.disableDefaultAgents === "boolean") out.disableDefaultAgents = r.disableDefaultAgents;
	if (typeof r.toolDescriptionMode === "string" && VALID_TOOL_DESCRIPTION_MODES.has(r.toolDescriptionMode)) {
		out.toolDescriptionMode = r.toolDescriptionMode;
	}
	if (typeof r.fleetView === "boolean") out.fleetView = r.fleetView;
	if (typeof r.agentMentions === "boolean") out.agentMentions = r.agentMentions ? "model" : "off";
	else if (typeof r.agentMentions === "string" && VALID_AGENT_MENTION_MODES.has(r.agentMentions)) out.agentMentions = r.agentMentions;
	if (typeof r.rememberAgents === "boolean") out.rememberAgents = r.rememberAgents;
	if (typeof r.widgetMode === "string" && VALID_WIDGET_MODES.has(r.widgetMode)) out.widgetMode = r.widgetMode;
	if (typeof r.outputTranscript === "boolean") out.outputTranscript = r.outputTranscript;
	if (r.fallbackSubagent === false) out.fallbackSubagent = "none";
	else if (typeof r.fallbackSubagent === "string" && r.fallbackSubagent.trim()) out.fallbackSubagent = r.fallbackSubagent.trim();
	return out;
}

function readSettingsFile(path: string): RawSettings {
	if (!existsSync(path)) return {};
	try {
		return sanitizeSettings(JSON.parse(readFileSync(path, "utf-8")));
	} catch {
		return {};
	}
}

function loadMergedSettings(): RawSettings {
	return { ...readSettingsFile(globalSettingsPath()), ...readSettingsFile(projectSettingsPath()) };
}

function saveProjectSettings(settings: RawSettings): void {
	const path = projectSettingsPath();
	mkdirSync(dirname(path), { recursive: true });
	const temporaryPath = `${path}.${process.pid}.tmp`;
	writeFileSync(temporaryPath, `${JSON.stringify(sanitizeSettings(settings), null, 2)}\n`, "utf-8");
	renameSync(temporaryPath, path);
}

function fullSettingsPatch(): RawSettings {
	return { ...DEFAULTS, ...loadMergedSettings() };
}

function settingStorageKey(settingId: string): string {
	return `settings:${SETTINGS_PAGE_ID}:${settingId}`;
}

function normalizeSettingValue(id: string, raw: unknown): SettingValue {
	switch (id) {
		case "maxConcurrent":
		case "defaultMaxTurns":
		case "graceTurns":
		case "maxSubagentDepth": {
			const parsed = typeof raw === "number" ? raw : Number(raw);
			if (!Number.isFinite(parsed)) return Number(DEFAULTS[id as keyof typeof DEFAULTS]);
			const bounds = {
				maxConcurrent: [1, MAX_CONCURRENT_CEILING],
				defaultMaxTurns: [0, MAX_TURNS_CEILING],
				graceTurns: [1, GRACE_TURNS_CEILING],
				maxSubagentDepth: [0, SUBAGENT_DEPTH_CEILING],
			} as const;
			const [minimum, maximum] = bounds[id as keyof typeof bounds];
			return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
		}
		case "schedulingEnabled":
		case "scopeModels":
		case "strictAgentFiles":
		case "disableDefaultAgents":
		case "rememberAgents":
		case "outputTranscript":
			return raw === true || raw === "true";
		case "fleetView":
			return raw !== false && raw !== "false";
		case "fallbackSubagent":
			return typeof raw === "string" ? raw.trim() : "";
		default:
			return String(raw ?? "");
	}
}


// ---- Settings definitions --------------------------------------------------

function joinModeOptions() {
	return [
		{ value: "smart", label: "Smart" },
		{ value: "async", label: "Async" },
		{ value: "group", label: "Group" },
	];
}

function widgetModeOptions() {
	return [
		{ value: "all", label: "All agents" },
		{ value: "background", label: "Background only" },
		{ value: "off", label: "Off" },
	];
}

function agentMentionOptions() {
	return [
		{ value: "model", label: "Model" },
		{ value: "direct", label: "Direct" },
		{ value: "off", label: "Off" },
	];
}

function toolDescriptionOptions() {
	return [
		{ value: "full", label: "Full" },
		{ value: "compact", label: "Compact" },
		{ value: "custom", label: "Custom" },
	];
}

function settingsDefinition(): {
	id: string;
	title: string;
	subtitle: string;
	icon: string;
	order: number;
	sections: AetherSettingsSection[];
} {
	return {
		id: SETTINGS_PAGE_ID,
		title: "Subagents",
		subtitle: "Subagent concurrency, dispatch, persistence, and Aether UI",
		icon: "auto",
		order: 30,
		sections: [
			{
				id: "runtime",
				title: "Runtime",
				settings: [
					{ id: "maxConcurrent", label: "Max concurrency", description: "Maximum concurrent background agents. Queued agents start as slots free.", type: "number", min: 1, max: MAX_CONCURRENT_CEILING },
					{ id: "defaultMaxTurns", label: "Default max turns", description: "Default maximum agentic turns before wrap-up. 0 means unlimited.", type: "number", min: 0, max: MAX_TURNS_CEILING },
					{ id: "graceTurns", label: "Grace turns", description: "Additional turns after the wrap-up steering message.", type: "number", min: 1, max: GRACE_TURNS_CEILING },
					{ id: "maxSubagentDepth", label: "Nested depth", description: "Hard cap on nested delegation. Main is 0; 0 or 1 disables nesting.", type: "number", min: 0, max: SUBAGENT_DEPTH_CEILING },
					{ id: "joinMode", label: "Join mode", description: "Default completion grouping for background agents.", type: "select", options: joinModeOptions() },
					{ id: "schedulingEnabled", label: "Scheduling", description: "Enable the schedule parameter and scheduled-job menu. Tool-spec changes apply on the next Pi session.", type: "toggle" },
					{ id: "outputTranscript", label: "Output transcript", description: "Write each subagent .output transcript by default. Agent frontmatter can override this.", type: "toggle" },
				],
			},
			{
				id: "agents",
				title: "Agents",
				settings: [
					{ id: "disableDefaultAgents", label: "Disable defaults", description: "Hide built-in general-purpose, Explore, and Plan agents. Custom agents are unaffected.", type: "toggle" },
					{ id: "fallbackSubagent", label: "Fallback agent", description: "Agent used when subagent_type is unknown, disabled, or ambiguous. none rejects the call instead.", type: "text", placeholder: "general-purpose", default: "general-purpose" },
					{ id: "strictAgentFiles", label: "Strict agent files", description: "Fail startup on an unreadable or unparseable agent .md file instead of skipping it.", type: "toggle" },
					{ id: "toolDescriptionMode", label: "Tool description", description: "Agent tool description size/mode. Custom reads .pi/agent-tool-description.md.", type: "select", options: toolDescriptionOptions() },
				],
			},
			{
				id: "models",
				title: "Models",
				settings: [
					{ id: "scopeModels", label: "Scope models", description: "Validate subagent model choices against Pi scoped models (/scoped-models).", type: "toggle" },
				],
			},
			{
				id: "ui",
				title: "Aether and Pi UI",
				settings: [
					{ id: "widgetMode", label: "Widget", description: "Live Aether agent card visibility above the composer.", type: "select", options: widgetModeOptions() },
					{ id: "fleetView", label: "Fleet view", description: "Keep the TUI FleetView enabled for Pi CLI; Aether renders the same roster as tappable cards.", type: "toggle" },
					{ id: "agentMentions", label: "Agent mentions", description: "Route @handle messages to that agent. Model starts new agents through an off-screen clone; direct starts them immediately.", type: "select", options: agentMentionOptions() },
					{ id: "rememberAgents", label: "Remember agents", description: "Persist subagent sessions so @handle can resume them long after completion.", type: "toggle" },
				],
			},
		],
	};
}

function seedSettingsStorage(api: AetherExtensionAPI): void {
	const settings = fullSettingsPatch();
	for (const section of settingsDefinition().sections) {
		for (const setting of section.settings) {
			const configured = settings[setting.id];
			const value = configured === undefined ? setting.default : configured;
			api.storage.set(settingStorageKey(setting.id), value as SettingValue);
			api.storage.set(setting.id, value as SettingValue);
		}
	}
}

async function applySettingAction(api: AetherExtensionAPI, id: string, payload: AetherJsonObject) {
	const raw = payload.value !== undefined ? payload.value : payload.checked;
	const value = normalizeSettingValue(id, raw);
	const next = fullSettingsPatch();
	if (id === "fallbackSubagent" && value === "") delete next.fallbackSubagent;
	else next[id] = value;
	saveProjectSettings(next);

	api.storage.set(settingStorageKey(id), value);
	api.storage.set(id, value);
	const bridge = readBridge();
	const applied = bridge?.applySetting(id, id === "fallbackSubagent" && value === "" ? undefined : value);
	if (id === "disableDefaultAgents") bridge?.onTypesChanged?.();
	api.invalidate?.();
	const message = applied?.ok && applied.message
		? applied.message
		: `Subagent setting updated.${["disableDefaultAgents", "strictAgentFiles", "toolDescriptionMode", "schedulingEnabled"].includes(id) ? " Some changes apply on the next Pi session." : ""}`;
	api.notify?.(message, "info");
	return { setting: id, value };
}


// ---- Message and surface rendering -----------------------------------------

function messageText(message: AetherJsonObject): string {
	if (typeof message.text === "string" && message.text) return message.text;
	if (typeof message.content === "string" && message.content) return message.content;
	if (Array.isArray(message.content)) {
		return message.content.map((part) => {
			if (!part || typeof part !== "object") return "";
			return typeof (part as AetherJsonObject).text === "string" ? (part as AetherJsonObject).text : "";
		}).join("\n");
	}
	return "";
}

function statusTone(status: string): "neutral" | "error" {
	return status === "error" || status === "stopped" || status === "aborted" ? "error" : "neutral";
}

function formatMs(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const totalSeconds = Math.round(ms / 1000);
	if (totalSeconds < 60) return `${totalSeconds}s`;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}m${seconds.toString().padStart(2, "0")}s`;
}

function notificationCard(api: AetherExtensionAPI, message: AetherJsonObject) {
	const details = message.details && typeof message.details === "object"
		? message.details as AetherJsonObject
		: message;
	const description = typeof details.description === "string" ? details.description : "Subagent";
	const status = typeof details.status === "string" ? details.status : "completed";
	const fallbackResult = messageText(message);
	const others = Array.isArray(details.others) ? details.others.filter((entry): entry is AetherJsonObject => !!entry && typeof entry === "object" && !Array.isArray(entry)) : [];
	const cards = [details, ...others].map((entry) => {
		const entryStatus = typeof entry.status === "string" ? entry.status : status;
		const entryDescription = typeof entry.description === "string" ? entry.description : description;
		const entryParts = [
			typeof entry.turnCount === "number" && entry.turnCount > 0 ? `${entry.turnCount} turns` : "",
			typeof entry.toolUses === "number" && entry.toolUses > 0 ? `${entry.toolUses} tool uses` : "",
			typeof entry.totalTokens === "number" && entry.totalTokens > 0 ? `${entry.totalTokens} tokens` : "",
			typeof entry.durationMs === "number" && entry.durationMs > 0 ? formatMs(Number(entry.durationMs)) : "",
		].filter(Boolean);
		const entryResultPreview = typeof entry.resultPreview === "string" ? entry.resultPreview : fallbackResult;
		const entryOutputFile = typeof entry.outputFile === "string" ? entry.outputFile : "";
		return api.ui.card([
			api.ui.row([
				api.ui.text("Subagent complete", { style: "label", weight: "bold", color: statusTone(entryStatus) === "error" ? "error" : "accent" }),
				api.ui.text(entryStatus, { style: "caption", color: statusTone(entryStatus) === "error" ? "error" : "muted" }),
			], { arrangement: "space-between", verticalAlignment: "center" }),
			api.ui.text(`${entryStatus === "error" || entryStatus === "stopped" || entryStatus === "aborted" ? "✗" : "✓"} ${entryDescription}`, { weight: "semibold" }),
			...(entryParts.length ? [api.ui.text(entryParts.join(" · "), { style: "caption", color: "muted" })] : []),
			...(entryResultPreview ? [api.ui.code(entryResultPreview, { maxLines: 12 })] : []),
			...(entryOutputFile ? [api.ui.text(entryOutputFile, { style: "caption", color: "muted" })] : []),
		], { tone: statusTone(entryStatus), radius: 14, contentPadding: 14 });
	});
	return api.ui.column(cards, { spacing: 8 });
}

function resultCard(api: AetherExtensionAPI, message: AetherJsonObject) {
	const text = messageText(message);
	const description = typeof message.description === "string" ? message.description : "Subagent result";
	return api.ui.card([
		api.ui.text(description, { style: "title" }),
		...(text ? [api.ui.code(text, { maxLines: 40 })] : [api.ui.text("No output.", { color: "muted" })]),
	], { radius: 14 });
}

function conversationCard(api: AetherExtensionAPI, message: AetherJsonObject) {
	const text = messageText(message);
	return api.ui.card([
		api.ui.text("Subagent conversation", { style: "title" }),
		...(text ? [api.ui.code(text, { maxLines: 80 })] : [api.ui.text("No conversation available.", { color: "muted" })]),
	], { radius: 14 });
}

function liveAgentsCard(api: AetherExtensionAPI): AetherView {
	const bridge = readBridge();
	const snapshot = bridge?.getSnapshot();
	if (!snapshot || snapshot.agents.length === 0) return null;
	const widgetMode = snapshot.settings.widgetMode;
	if (widgetMode === "off" && !snapshot.settings.fleetView) return null;

	const visible = snapshot.agents.filter((agent) => {
		if (agent.status !== "running" && agent.status !== "queued") {
			if (agent.completedAt === undefined) return false;
			if (Date.now() - agent.completedAt > 15_000) return false;
		}
		return widgetMode !== "background" || agent.isBackground !== false;
	});
	if (visible.length === 0) return null;

	const rows = visible.slice(0, 6).map((agent) => {
		const statusText = agent.status === "queued" ? "queued" : agent.status;
		const color = agent.status === "error" || agent.status === "stopped" || agent.status === "aborted"
			? "error"
			: agent.status === "completed" || agent.status === "steered"
				? "muted"
				: "accent";
		const stats = [
			agent.activity,
			agent.turnCount > 0 ? `${agent.turnCount} turns` : "",
			agent.toolUses > 0 ? `${agent.toolUses} tools` : "",
			agent.tokens,
			agent.durationMs > 0 ? formatMs(agent.durationMs) : "",
		].filter(Boolean).join(" · ");
		const buttons: AetherView[] = [];
		if (agent.status === "running" || agent.status === "queued") {
			buttons.push(api.ui.button("View", "agent-view", { args: { id: agent.id }, tone: "neutral", icon: "info" }));
			buttons.push(api.ui.button("Stop", "agent-stop", { args: { id: agent.id }, tone: "danger" }));
		} else {
			buttons.push(api.ui.button("Result", "agent-result", { args: { id: agent.id }, tone: "neutral" }));
			buttons.push(api.ui.button("Conversation", "agent-view", { args: { id: agent.id }, tone: "neutral" }));
		}
		return api.ui.card([
			api.ui.row([
				api.ui.text(`${agent.status === "running" ? "●" : agent.status === "queued" ? "○" : agent.status === "error" || agent.status === "stopped" || agent.status === "aborted" ? "✗" : "✓"} ${agent.displayName}`, { weight: "bold", color }),
				api.ui.text(statusText, { style: "caption", color }),
			], { arrangement: "space-between", verticalAlignment: "center" }),
			api.ui.text(agent.description || agent.type, { style: "caption", color: "muted" }),
			...(stats ? [api.ui.text(stats, { style: "caption", color: "muted" })] : []),
			api.ui.row(buttons, { wrap: true, rowSpacing: 8 }),
		], { radius: 14, contentPadding: 12 });
	});
	const remaining = visible.length - rows.length;
	return api.ui.card([
		api.ui.row([
			api.ui.text("Agents", { style: "title" }),
			api.ui.text(`${snapshot.running} running · ${snapshot.queued} queued`, { style: "caption", color: "muted" }),
		], { arrangement: "space-between", verticalAlignment: "center" }),
		...rows,
		...(remaining > 0 ? [api.ui.text(`${remaining} more agent${remaining === 1 ? "" : "s"}`, { style: "caption", color: "muted" })] : []),
	], { radius: 18, contentPadding: 14 });
}

function viewerOverlay(api: AetherExtensionAPI, context: AetherRenderContext): AetherView {
	const bridge = readBridge();
	const selectedId = typeof context.storage.viewerAgentId === "string" ? context.storage.viewerAgentId : "";
	if (!selectedId) return null;
	const selectedSessionId = typeof context.storage.viewerSessionId === "string" ? context.storage.viewerSessionId : "";
	const currentSessionId = typeof context.session_id === "string" ? context.session_id : "";
	if (selectedSessionId && currentSessionId && selectedSessionId !== currentSessionId) return null;
	const agent = bridge?.getSnapshot().agents.find((candidate) => candidate.id === selectedId);
	const conversation = agent && bridge?.getConversation(selectedId);
	return api.ui.node("scroll", {
		width: "fill",
		height: "fill",
		background: "#CC000000",
		children: [
			api.ui.card([
				api.ui.row([
					api.ui.text(agent ? `${agent.displayName} — ${agent.description || agent.type}` : "Subagent unavailable", { style: "title" }),
					api.ui.button("Close", "viewer-close", { tone: "neutral" }),
				], { arrangement: "space-between", verticalAlignment: "center", wrap: true, rowSpacing: 8 }),
				...(agent ? [
					api.ui.text(`${agent.status} · ${agent.toolUses} tool uses · ${agent.tokens} · ${formatMs(agent.durationMs)}`, { style: "caption", color: "muted" }),
					(agent.status === "running" || agent.status === "queued")
						? api.ui.input("", "agent-steer", {
							args: { id: agent.id },
							placeholder: "Message this agent, then press Done",
							singleLine: false,
						})
						: null,
				] : []),
				...(conversation ? [api.ui.code(conversation, { fontSize: 12 })] : [api.ui.text("No conversation available yet.", { color: "muted" })]),
				...(agent && (agent.status === "running" || agent.status === "queued")
					? [api.ui.button("Stop agent", "agent-stop", { args: { id: agent.id }, tone: "danger" })]
					: []),
			], { radius: 22, contentPadding: 16, width: "fill", maxHeight: 720 }),
		],
	});
}

function fallbackActivityCard(api: AetherExtensionAPI, context: AetherRenderContext): AetherView {
	if (Array.isArray(context.custom_messages)) return null;
	const latest = context.storage.latestSubagentActivity;
	if (!latest || typeof latest !== "object" || Array.isArray(latest)) return null;
	const activity = latest as AetherJsonObject;
	return api.ui.column([
		api.ui.card([
			api.ui.text(typeof activity.title === "string" ? activity.title : "Subagent activity", { style: "label", weight: "bold" }),
			...(typeof activity.text === "string" && activity.text ? [api.ui.text(activity.text, { maxLines: 6 })] : []),
		]),
		api.ui.button("Dismiss", "dismiss-activity", { tone: "neutral" }),
	], { spacing: 6 });
}

function messageTypes(api: AetherExtensionAPI): AetherMessageTypeDefinition[] {
	return [
		{ type: "subagent-notification", title: "Subagent complete", icon: "auto", render: ({ message }) => notificationCard(api, message) },
		{ type: "subagent-result", title: "Subagent result", icon: "info", render: ({ message }) => resultCard(api, message) },
		{ type: "subagent-conversation", title: "Subagent conversation", icon: "terminal", render: ({ message }) => conversationCard(api, message) },
	];
}

export async function appendAetherSubagentMessage(
	type: string,
	payload: AetherJsonObject,
	text = "",
): Promise<boolean> {
	const bridge = readBridge();
	if (!bridge?.api) return false;
	try {
		bridge.api.storage.set("latestSubagentActivity", {
			type,
			title: type === "subagent-notification" ? "Subagent complete" : "Subagent activity",
			text: text.slice(0, 2000),
			at: Date.now(),
		});
		await bridge.api.messages.append(type, payload, text);
		return true;
	} catch {
		return false;
	}
}


// ---- Actions ----------------------------------------------------------------

async function runAgentAction(api: AetherExtensionAPI, action: string, payload: AetherJsonObject, context?: AetherRenderContext): Promise<unknown> {
	const bridge = readBridge();
	if (!bridge) return { ok: false, error: "The pi-subagents Pi extension is not loaded." };
	const id = typeof payload.id === "string" ? payload.id : "";
	switch (action) {
		case "agent-stop": {
			if (!id) return { ok: false };
			const stopped = bridge.abort(id);
			api.notify?.(stopped ? "Subagent stopped." : "Subagent is no longer running.", stopped ? "info" : "warning");
			api.invalidate?.();
			return { ok: stopped, id };
		}
		case "agent-steer": {
			const message = typeof payload.value === "string" ? payload.value.trim() : "";
			if (!id || !message) return { ok: false };
			const steered = bridge.steer(id, message);
			api.notify?.(steered ? `Message sent to ${id}.` : "That agent is not running.", steered ? "info" : "warning");
			api.invalidate?.();
			return { ok: steered, id };
		}
		case "agent-view": {
			if (!id) return { ok: false };
			api.storage.set("viewerAgentId", id);
			const sessionId = typeof context?.session_id === "string" ? context.session_id : "";
			if (sessionId) api.storage.set("viewerSessionId", sessionId);
			else api.storage.delete("viewerSessionId");
			api.invalidate?.();
			return { ok: true, id };
		}
		case "agent-result": {
			if (!id) return { ok: false };
			const result = bridge.getResult(id) ?? "";
			await api.messages.append("subagent-result", { id, result }, result);
			return { ok: true, id };
		}
		case "agent-conversation": {
			if (!id) return { ok: false };
			const conversation = bridge.getConversation(id) ?? "";
			await api.messages.append("subagent-conversation", { id, conversation }, conversation);
			return { ok: true, id };
		}
		case "agent-toggle": {
			const name = typeof payload.name === "string" ? payload.name : "";
			if (!name) return { ok: false };
			const result = bridge.toggleAgent(name);
			api.notify?.(result.message, result.ok ? "info" : "warning");
			api.invalidate?.();
			bridge.onTypesChanged?.();
			return result;
		}
		case "agent-reload": {
			bridge.reloadAgents();
			api.notify?.("Reloaded subagent definitions.", "info");
			api.invalidate?.();
			bridge.onTypesChanged?.();
			return { ok: true };
		}
		case "agent-create": {
			const prompt = "Create a custom pi subagent definition at .pi/agents/<name>.md with YAML frontmatter (description, tools, model, thinking) and a system prompt body. Ask me for the agent name and what it should do if I have not already told you.";
			await api.host.invoke("app.openScreen", { screen: "chat" });
			await api.host.invoke("app.appendDraftInput", { text: prompt });
			api.notify?.("Subagent definition prompt added to the composer.", "info");
			return { ok: true };
		}
		default:
			return { ok: false };
	}
}

// ---- Aether activation ------------------------------------------------------

const SUBAGENT_TOOL_TITLES = [
	["Agent", "Running subagent", "Ran subagent"],
	["get_subagent_result", "Checking subagent result", "Checked subagent result"],
	["steer_subagent", "Steering subagent", "Steered subagent"],
] as const;

export const activateAether = async (api: AetherExtensionAPI) => {
	seedSettingsStorage(api);

	for (const [toolName, runningTitle, completedTitle] of SUBAGENT_TOOL_TITLES) {
		api.registerToolTitle?.(toolName, runningTitle, completedTitle, 200);
	}

	for (const section of settingsDefinition().sections) {
		for (const setting of section.settings) {
			api.registerAction(`settings:${SETTINGS_PAGE_ID}:${setting.id}`, async (payload) =>
				applySettingAction(api, setting.id, payload),
			);
		}
	}
	api.registerSettings(settingsDefinition());

	// Agent-type management lives on its own page so long type lists never
	// crowd the runtime settings. Re-registered when the bridge notices a
	// custom-agent reload.
	const typeSettingId = (name: string) => {
		const slug = name.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
		return `type:${slug || "agent"}`;
	};
	const typeSettingStorageKey = (id: string) => `settings:${AGENTS_PAGE_ID}:${id}`;

	const registerAgentTypesPage = () => {
		const bridge = readBridge();
		const types = bridge?.getSnapshot().types ?? [];
		const typeSettings = types.map((type) => ({
			id: typeSettingId(type.name),
			label: type.displayName,
			description: [
				type.description,
				`${type.source}${type.isDefault ? " default" : ""}`,
			].filter(Boolean).join("\n"),
			type: "toggle" as const,
			default: type.enabled,
		}));
		const typeSections: AetherSettingsSection[] = typeSettings.length > 0
			? [{
				id: "types",
				title: "Agent types",
				description: "Enable or disable individual agent types. Disabled built-ins get a project stub; disabled custom agents keep their file.",
				settings: typeSettings,
			}]
			: [];
		const definition = {
			id: AGENTS_PAGE_ID,
			title: "Subagent Types",
			subtitle: "Enable, disable, and reload custom agent definitions",
			icon: "auto",
			order: 31,
			sections: [
				{
					id: "manage",
					title: "Manage",
					settings: [
						{ id: "create", label: "Create agent definition", description: "Add a prompt to the composer asking the main model to create .pi/agents/<name>.md.", type: "button" as const, action: "agent-create", tone: "primary" as const, icon: "add" },
						{ id: "reload", label: "Reload agent files", description: "Re-read project, workspace, and personal agent definitions now.", type: "button" as const, action: "agent-reload", tone: "neutral" as const, icon: "refresh" },
					],
				},
				...typeSections,
			],
		};
		try {
			api.registerSettings(definition);
		} catch {
			// The runtime page remains useful without type rows.
		}

		for (const type of types) {
			const settingId = typeSettingId(type.name);
			api.registerAction(`settings:${AGENTS_PAGE_ID}:${settingId}`, async (payload) => {
				const nextEnabled = payload.checked === true || payload.value === true || payload.value === "true";
				const result = bridge?.toggleAgent(type.name) ?? { ok: false, message: "The pi-subagents Pi extension is not loaded." };
				if (result.ok) {
					api.storage.set(typeSettingStorageKey(settingId), nextEnabled);
					api.notify?.(result.message, "info");
				} else {
					api.storage.set(typeSettingStorageKey(settingId), type.enabled);
					api.notify?.(result.message, "warning");
				}
				registerAgentTypesPage();
				api.invalidate?.();
				return { setting: settingId, value: nextEnabled };
			});
		}
	};
	registerAgentTypesPage();
	const bridgeExistedAtAttach = readBridge() !== undefined;
	attachAetherApi(api, (bridge) => {
		bridge.onTypesChanged = registerAgentTypesPage;
		if (!bridgeExistedAtAttach) registerAgentTypesPage();
	});

	api.registerAction("agent-stop", (payload) => runAgentAction(api, "agent-stop", payload));
	api.registerAction("agent-steer", (payload) => runAgentAction(api, "agent-steer", payload));
	api.registerAction("agent-view", (payload, context) => runAgentAction(api, "agent-view", payload, context));
	api.registerAction("agent-result", (payload) => runAgentAction(api, "agent-result", payload));
	api.registerAction("agent-conversation", (payload) => runAgentAction(api, "agent-conversation", payload));
	api.registerAction("agent-toggle", (payload) => runAgentAction(api, "agent-toggle", payload));
	api.registerAction("agent-reload", (payload) => runAgentAction(api, "agent-reload", payload));
	api.registerAction("agent-create", (payload) => runAgentAction(api, "agent-create", payload));
	api.registerAction("viewer-close", () => {
		api.storage.delete("viewerAgentId");
		api.storage.delete("viewerSessionId");
	});
	api.registerAction("dismiss-activity", () => api.storage.delete("latestSubagentActivity"));

	api.registerAction("mention-agent", async (payload) => {
		const name = typeof payload.name === "string" ? payload.name : "";
		if (!name) return { ok: false };
		await api.host.invoke("app.appendDraftInput", { text: `@${name} ` });
	});

	api.registerComposerMenuItem({
		id: "subagents",
		title: "Subagents",
		subtitle: "Draft a subagent creation request",
		icon: "auto",
		order: 20,
		action: "agent-create",
	});

	for (const definition of messageTypes(api)) api.registerMessageType(definition);

	api.registerSurface("chat.composer.top", {
		id: "subagents-live",
		order: 10,
		render: () => liveAgentsCard(api),
	});
	api.registerSurface("chat.list.end", {
		id: "subagents-activity",
		order: 90,
		render: (context) => fallbackActivityCard(api, context),
	});
	api.registerSurface("app.overlay", {
		id: "subagents-viewer",
		order: 80,
		render: (context) => viewerOverlay(api, context),
	});

	api.on?.("before_send", async (payload) => {
		const bridge = readBridge();
		if (!bridge) return undefined;
		const text = typeof payload.text === "string" ? payload.text : "";
		if (!text.startsWith("@")) return undefined;
		const result = await bridge.dispatchMention(text);
		if (result.action === "handled") return { cancelled: true };
		if (result.action === "transform") return { text: result.text ?? "" };
		return undefined;
	});

	return () => {
		const current = readBridge();
		if (current?.api === api) current.api = undefined;
		if (readAetherBridgeState()?.api === api) delete (globalThis as Record<PropertyKey, unknown>)[API_KEY];
	};
};

