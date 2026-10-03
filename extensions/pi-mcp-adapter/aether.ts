import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import stripJsonComments from "strip-json-comments";
import { getAgentPath } from "./agent-dir.ts";
import {
  attachMcpAetherApi,
  readMcpAetherBridge,
  type McpAetherBridge,
  type McpAetherServerSnapshot,
  type McpAetherSnapshot,
} from "./aether-bridge.ts";

type AetherJsonObject = Record<string, unknown>;
type AetherView = AetherJsonObject | AetherView[] | string | null | undefined;
type AetherRenderContext = AetherJsonObject & { storage: AetherJsonObject };

export interface AetherSettingOption {
  value: string;
  label: string;
}

export interface AetherSettingActionItem {
  label: string;
  action: string;
  args?: AetherJsonObject;
  category?: string;
  tone?: "primary" | "neutral" | "danger";
  enabled?: boolean;
}

export interface AetherSettingDetailItem {
  label: string;
  value: string;
}

export interface AetherSettingDefinition {
  id: string;
  label?: string;
  title?: string;
  description?: string;
  subtitle?: string;
  tag?: string;
  pill?: string;
  badge?: string;
  type?:
    | "text"
    | "password"
    | "textarea"
    | "number"
    | "toggle"
    | "select"
    | "dropdown"
    | "segmented"
    | "tab"
    | "tabs"
    | "slider"
    | "button"
    | "link"
    | "label"
    | "divider"
    | "spacer"
    | "item-card"
    | "card"
    | "empty-state"
    | "choice"
    | "radio"
    | "action-row"
    | "chips"
    | "detail-line"
    | "key-value"
    | "pill"
    | "badge"
    | "result-card"
    | "callout";
  default?: string | number | boolean;
  placeholder?: string;
  options?: AetherSettingOption[];
  min?: number;
  max?: number;
  step?: number;
  action?: string;
  args?: AetherJsonObject;
  category?: string;
  url?: string;
  icon?: string;
  tone?: "primary" | "neutral" | "danger";
  enabled?: boolean;
  checked?: boolean;
  selected?: boolean;
  toggleAction?: string;
  editAction?: string;
  editCategory?: string;
  editArgs?: AetherJsonObject;
  deleteAction?: string;
  deleteArgs?: AetherJsonObject;
  expanded?: boolean;
  actions?: AetherSettingActionItem[];
  details?: AetherSettingDetailItem[];
  resultText?: string;
  result?: string;
  buttonLabel?: string;
  multiline?: boolean;
  secret?: boolean;
  settings?: AetherSettingDefinition[];
}

export interface AetherSettingsSection {
  id?: string;
  title?: string;
  description?: string;
  settings: AetherSettingDefinition[];
}

export interface AetherSettingsCategory {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  order?: number;
  trailingIcon?: string;
  trailingAction?: string;
  trailingCategory?: string;
  trailingArgs?: AetherJsonObject;
  hidden?: boolean;
  sections: AetherSettingsSection[];
}

export interface AetherSettingsDefinition {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  order?: number;
  trailingIcon?: string;
  trailingAction?: string;
  trailingCategory?: string;
  trailingArgs?: AetherJsonObject;
  sections?: AetherSettingsSection[];
  categories?: AetherSettingsCategory[];
}

export interface AetherExtensionAPI {
  ui: {
    node(type: string, properties?: AetherJsonObject, children?: AetherView[]): AetherJsonObject;
    text(text: string, properties?: AetherJsonObject): AetherJsonObject;
    column(children: AetherView[], properties?: AetherJsonObject): AetherJsonObject;
    row(children: AetherView[], properties?: AetherJsonObject): AetherJsonObject;
    card(children: AetherView[], properties?: AetherJsonObject): AetherJsonObject;
    button(label: string, action: string, properties?: AetherJsonObject): AetherJsonObject;
  };
  host: { invoke(method: string, args?: AetherJsonObject): Promise<AetherJsonObject> };
  storage: {
    get<T = unknown>(key: string, fallback?: T): T;
    set(key: string, value: unknown): void;
    delete(key: string): void;
    snapshot(): AetherJsonObject;
  };
  messages: { append(type: string, payload?: AetherJsonObject, text?: string): Promise<AetherJsonObject> };
  registerSettings(definition: AetherSettingsDefinition): () => void;
  registerAction(id: string, handler: (payload: AetherJsonObject) => unknown | Promise<unknown>): () => void;
  registerToolTitle?(toolName: string, runningTitle: string, completedTitle: string, priority?: number): () => void;
  invalidate(): void;
  notify(message: string, level?: "info" | "warning" | "error"): void;
}

const PAGE_ID = "mcp-settings";
const BRIDGE_OAUTH_KEY = "mcp:oauth-pending";
const settingStorageKey = (settingId: string) => `settings:${PAGE_ID}:${settingId}`;

type Transport = "stdio" | "http" | "socket";

const TRANSPORT_OPTIONS = [
  { value: "stdio", label: "Standard I/O (command)" },
  { value: "http", label: "HTTP (Streamable HTTP / SSE)" },
  { value: "socket", label: "Unix socket (rmcp-mux)" },
] as const;

const LIFECYCLE_OPTIONS = [
  { value: "lazy", label: "Lazy (connect on first use)" },
  { value: "eager", label: "Eager (connect at session start)" },
  { value: "keep-alive", label: "Keep alive" },
  { value: "lazy-keep-alive", label: "Lazy, then keep alive" },
] as const;

const PROTOCOL_OPTIONS = [
  { value: "legacy", label: "Legacy (default)" },
  { value: "auto", label: "Auto (2026 with legacy fallback)" },
  { value: "2026-07-28", label: "2026-07-28 only" },
] as const;

const HTTP_TRANSPORT_OPTIONS = [
  { value: "auto", label: "Auto (Streamable HTTP with SSE fallback)" },
  { value: "streamable-http", label: "Streamable HTTP" },
  { value: "sse", label: "SSE" },
] as const;

const AUTH_OPTIONS = [
  { value: "auto", label: "Auto (OAuth when available)" },
  { value: "oauth", label: "OAuth" },
  { value: "bearer", label: "Bearer token" },
  { value: "none", label: "None" },
] as const;

const BOOLEAN_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
] as const;

const TOOL_PREFIX_OPTIONS = [
  { value: "unset", label: "Use global setting" },
  { value: "server", label: "server (server__tool)" },
  { value: "short", label: "short (server_tool)" },
  { value: "none", label: "none (original name)" },
  { value: "mcp", label: "mcp (mcp__tool)" },
] as const;

const DIRECT_TOOLS_OPTIONS = [
  { value: "unset", label: "Use global setting" },
  { value: "all", label: "All as direct tools" },
  { value: "proxy-only", label: "Proxy tool only" },
  { value: "custom", label: "Custom tool list" },
] as const;

const GRANT_TYPE_OPTIONS = [
  { value: "default", label: "Authorization code (default)" },
  { value: "authorization_code", label: "Authorization code" },
  { value: "client_credentials", label: "Client credentials" },
] as const;

// ---------------------------------------------------------------------------
// Config file access (Pi global override)
// ---------------------------------------------------------------------------

function configPath(): string {
  return getAgentPath("mcp.json");
}

function parseJsonText(raw: string): unknown {
  return JSON.parse(stripJsonComments(raw, { trailingCommas: true }));
}

function readRawConfig(): AetherJsonObject {
  const path = configPath();
  if (!existsSync(path)) return {};
  try {
    const parsed = parseJsonText(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as AetherJsonObject : {};
  } catch (error) {
    throw new Error(`Failed to read MCP config at ${path}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

function readServers(): Record<string, AetherJsonObject> {
  const raw = readRawConfig();
  const servers = raw.mcpServers ?? raw["mcp-servers"] ?? {};
  if (!servers || typeof servers !== "object" || Array.isArray(servers)) return {};
  const result: Record<string, AetherJsonObject> = {};
  for (const [name, entry] of Object.entries(servers)) {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) result[name] = entry as AetherJsonObject;
  }
  return result;
}

function writeServers(servers: Record<string, AetherJsonObject>): void {
  const path = configPath();
  const raw = readRawConfig();
  delete raw["mcp-servers"];
  raw.mcpServers = servers;
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
  try {
    chmodSync(temporaryPath, 0o600);
  } catch {
    // Windows and some container filesystems do not support POSIX modes.
  }
  renameSync(temporaryPath, path);
}

// ---------------------------------------------------------------------------
// Value normalization
// ---------------------------------------------------------------------------

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function stored(api: AetherExtensionAPI, settingId: string, fallback: string): string {
  const value = api.storage.get<string | number | boolean>(settingStorageKey(settingId))
    ?? api.storage.get<string | number | boolean>(settingId, fallback);
  return asString(value, fallback);
}

function storedBoolean(api: AetherExtensionAPI, settingId: string, fallback: boolean): boolean {
  const value = api.storage.get<boolean>(settingStorageKey(settingId))
    ?? api.storage.get<boolean>(settingId, fallback);
  return value === true;
}

function storeSetting(api: AetherExtensionAPI, settingId: string, value: string | number | boolean): void {
  api.storage.set(settingId, value);
  api.storage.set(settingStorageKey(settingId), value);
}

function clearSetting(api: AetherExtensionAPI, settingId: string): void {
  api.storage.delete(settingId);
  api.storage.delete(settingStorageKey(settingId));
}

function clearServerStorage(api: AetherExtensionAPI, serverName: string): void {
  const prefix = `server:${serverName}:`;
  for (const [key, value] of Object.entries(api.storage.snapshot())) {
    if (key.startsWith(prefix) || key.startsWith(settingStorageKey(prefix))) {
      void value;
      api.storage.delete(key);
    }
  }
  api.storage.delete(`mcp:inspect:${serverName}`);
}

function validateServerName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Server name is required.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(trimmed)) {
    throw new Error("Server name may contain only letters, numbers, dots, dashes, and underscores, and must start with a letter or number.");
  }
  return trimmed;
}

function stringValue(value: string, present: boolean): string | undefined {
  return present && value.trim() !== "" ? value : undefined;
}

function integerValue(value: string, present: boolean): number | undefined {
  if (!present) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) throw new Error(`Expected an integer, got "${trimmed}".`);
  return parsed;
}

function booleanValue(value: unknown): boolean | undefined {
  return value === true;
}

function parseRecord(value: string, labelText: string): Record<string, string> | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = JSON.parse(stripJsonComments(trimmed, { trailingCommas: true }));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${labelText} must be a JSON object.`);
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(parsed)) {
    if (typeof entry !== "string") throw new Error(`${labelText}.${key} must be a string.`);
    result[key] = entry;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseList(value: string, labelText: string): string[] | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(stripJsonComments(trimmed, { trailingCommas: true }));
    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
      throw new Error(`${labelText} must be a JSON array of strings.`);
    }
    return parsed.length > 0 ? parsed as string[] : undefined;
  }
  const lines = trimmed.includes("\n")
    ? trimmed.split(/\r?\n/)
    : trimmed.split(",");
  const entries = lines.map((entry) => entry.trim()).filter(Boolean);
  return entries.length > 0 ? entries : undefined;
}

function parseKeywordRecord(value: string): Record<string, string[]> | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = JSON.parse(stripJsonComments(trimmed, { trailingCommas: true }));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("searchKeywords must be a JSON object.");
  const result: Record<string, string[]> = {};
  for (const [key, entry] of Object.entries(parsed)) {
    if (!Array.isArray(entry) || entry.some((keyword) => typeof keyword !== "string")) {
      throw new Error(`searchKeywords.${key} must be an array of strings.`);
    }
    result[key] = entry as string[];
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function formatRecord(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) return JSON.stringify(value, null, 2);
  return typeof value === "string" ? value : "";
}

function formatList(value: unknown): string {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string").join("\n");
  return typeof value === "string" ? value : "";
}

function deriveTransport(entry: AetherJsonObject): Transport {
  if (typeof entry.command === "string") return "stdio";
  if (typeof entry.socket === "string") return "socket";
  if (typeof entry.url === "string") return "http";
  return "stdio";
}

function serverFieldValue(entry: AetherJsonObject, field: string, fallback = ""): string {
  return asString(entry[field], fallback);
}

function authMode(entry: AetherJsonObject): string {
  if (entry.auth === "oauth") return "oauth";
  if (entry.auth === "bearer") return "bearer";
  if (entry.auth === false) return "none";
  return "auto";
}

function booleanOrListMode(value: unknown): string {
  if (value === true) return "all";
  if (value === false) return "proxy-only";
  if (Array.isArray(value)) return "custom";
  return "unset";
}

function directToolsMode(entry: AetherJsonObject): string {
  return booleanOrListMode(entry.directTools);
}

function booleanSelectValue(entry: AetherJsonObject, field: string): string {
  const value = entry[field];
  if (value === true) return "true";
  if (value === false) return "false";
  return "default";
}

function oauthValue(entry: AetherJsonObject, field: string, fallback = ""): string {
  const oauth = entry.oauth;
  if (!oauth || typeof oauth !== "object" || Array.isArray(oauth)) return fallback;
  return asString((oauth as AetherJsonObject)[field], fallback);
}

function oauthSkipIssuer(entry: AetherJsonObject): boolean {
  const oauth = entry.oauth;
  return Boolean(oauth && typeof oauth === "object" && !Array.isArray(oauth)
    ? (oauth as AetherJsonObject).skipIssuerMetadataValidation === true
    : false);
}

function requestHeadersCommandValue(entry: AetherJsonObject): string {
  return formatRecord(entry.requestHeadersCommand);
}

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

function text(id: string, labelText: string, description: string, value: string, extra: Partial<AetherSettingDefinition> = {}): AetherSettingDefinition {
  return { id, type: "text", label: labelText, description, default: value, ...extra };
}

function password(id: string, labelText: string, description: string, value: string): AetherSettingDefinition {
  return { id, type: "password", label: labelText, description, default: value };
}

function textarea(id: string, labelText: string, description: string, value: string): AetherSettingDefinition {
  return { id, type: "textarea", label: labelText, description, default: value };
}

function number(id: string, labelText: string, description: string, value: string): AetherSettingDefinition {
  return { id, type: "number", label: labelText, description, default: value, min: 0 };
}

function toggle(id: string, labelText: string, description: string, value: boolean): AetherSettingDefinition {
  return { id, type: "toggle", label: labelText, description, default: value };
}

function select(id: string, labelText: string, description: string, value: string, options: ReadonlyArray<{ value: string; label: string }>): AetherSettingDefinition {
  return { id, type: "select", label: labelText, description, default: value, options: options.map((option) => ({ value: option.value, label: option.label })) };
}

function button(id: string, labelText: string, action: string, args: AetherJsonObject, description = "", tone: "primary" | "neutral" | "danger" = "neutral"): AetherSettingDefinition {
  return { id, type: "button", label: labelText, description, action, args, tone };
}

function label(id: string, labelText: string, description: string): AetherSettingDefinition {
  return { id, type: "label", label: labelText, description };
}

function link(id: string, labelText: string, url: string, description = ""): AetherSettingDefinition {
  return { id, type: "link", label: labelText, url, description };
}

// ---------------------------------------------------------------------------
// Form builders
// ---------------------------------------------------------------------------

function transportSettings(api: AetherExtensionAPI, prefix: string, transport: Transport, entry: AetherJsonObject): AetherSettingDefinition[] {
  const value = (id: string, fallback: string) => stored(api, id, fallback);
  const settings: AetherSettingDefinition[] = [];
  if (transport === "stdio") {
    settings.push(
      text(`${prefix}command`, "Command", "Executable for the stdio transport, for example npx or uvx.", value(`${prefix}command`, serverFieldValue(entry, "command"))),
      textarea(`${prefix}args`, "Arguments", "One argument per line. Environment interpolation is supported.", value(`${prefix}args`, formatList(entry.args))),
      textarea(`${prefix}env`, "Environment", 'JSON object such as {"API_KEY": "$ENV_VAR"}. A value beginning with ! runs a command when the server connects.', value(`${prefix}env`, formatRecord(entry.env))),
      text(`${prefix}cwd`, "Working directory", "Optional. Supports ${VAR}, $env:VAR, and ~.", value(`${prefix}cwd`, serverFieldValue(entry, "cwd"))),
    );
  } else if (transport === "http") {
    settings.push(
      text(`${prefix}url`, "URL", "HTTP MCP endpoint. Supports Streamable HTTP and legacy SSE.", value(`${prefix}url`, serverFieldValue(entry, "url"))),
      select(`${prefix}httpTransport`, "HTTP transport", "Force a transport or let the adapter auto-negotiate.", value(`${prefix}httpTransport`, asString(entry.httpTransport, "auto")), HTTP_TRANSPORT_OPTIONS),
      select(`${prefix}auth`, "Authentication", "OAuth is auto-detected by default unless custom headers are configured.", value(`${prefix}auth`, authMode(entry)), AUTH_OPTIONS),
      password(`${prefix}bearerToken`, "Bearer token", "Optional static token. Supports ${VAR}, $env:VAR, and !command sources.", value(`${prefix}bearerToken`, serverFieldValue(entry, "bearerToken"))),
      text(`${prefix}bearerTokenEnv`, "Bearer token env var", "Optional environment variable containing the bearer token.", value(`${prefix}bearerTokenEnv`, serverFieldValue(entry, "bearerTokenEnv"))),
      textarea(`${prefix}headers`, "HTTP headers", 'JSON object such as {"Authorization": "Bearer ${TOKEN}"}.', value(`${prefix}headers`, formatRecord(entry.headers))),
      select(`${prefix}oauthGrantType`, "OAuth grant type", "Client credentials completes without opening a browser.", value(`${prefix}oauthGrantType`, oauthValue(entry, "grantType", "default")), GRANT_TYPE_OPTIONS),
      text(`${prefix}oauthClientId`, "OAuth client ID", "Optional pre-registered client ID. Dynamic registration is used when empty.", value(`${prefix}oauthClientId`, oauthValue(entry, "clientId"))),
      password(`${prefix}oauthClientSecret`, "OAuth client secret", "Optional confidential-client secret. A leading ! runs a command.", value(`${prefix}oauthClientSecret`, oauthValue(entry, "clientSecret"))),
      text(`${prefix}oauthScope`, "OAuth scopes", "Space-separated scopes requested from the authorization server.", value(`${prefix}oauthScope`, oauthValue(entry, "scope"))),
      text(`${prefix}oauthRedirectUri`, "OAuth redirect URI", "Exact pre-registered localhost callback, including port and path.", value(`${prefix}oauthRedirectUri`, oauthValue(entry, "redirectUri"))),
      text(`${prefix}oauthClientName`, "OAuth client name", "Client display name advertised during dynamic registration.", value(`${prefix}oauthClientName`, oauthValue(entry, "clientName"))),
      text(`${prefix}oauthClientUri`, "OAuth client URI", "Client homepage advertised during dynamic registration.", value(`${prefix}oauthClientUri`, oauthValue(entry, "clientUri"))),
      text(`${prefix}oauthLogoUri`, "OAuth logo URL", "Absolute http(s) logo URL advertised during dynamic registration.", value(`${prefix}oauthLogoUri`, oauthValue(entry, "logoUri"))),
      toggle(`${prefix}oauthSkipIssuerValidation`, "Skip OAuth issuer validation", "Security-weakening escape hatch for known-misconfigured authorization servers.", oauthSkipIssuer(entry)),
      textarea(`${prefix}oauthAuthorizationParams`, "OAuth authorization params", 'Optional JSON object of extra authorization URL parameters.', value(`${prefix}oauthAuthorizationParams`, formatRecord((entry.oauth as AetherJsonObject | undefined)?.authorizationParams))),
      textarea(`${prefix}requestHeadersCommand`, "Per-request headers command", 'Optional JSON object { "command": "...", "args": [...] }. Derives fail-closed headers for every HTTP request.', value(`${prefix}requestHeadersCommand`, requestHeadersCommandValue(entry))),
    );
  } else {
    settings.push(
      text(`${prefix}socket`, "Socket path", "Explicit rmcp-mux Unix-domain socket. Supports ${VAR}, $env:VAR, and ~.", value(`${prefix}socket`, serverFieldValue(entry, "socket"))),
    );
  }
  return settings;
}

function commonSettings(api: AetherExtensionAPI, prefix: string, entry: AetherJsonObject): AetherSettingDefinition[] {
  const value = (id: string, fallback: string) => stored(api, id, fallback);
  const directMode = value(`${prefix}directTools`, directToolsMode(entry));
  return [
    select(`${prefix}lifecycle`, "Lifecycle", "When the server process or HTTP session is connected.", value(`${prefix}lifecycle`, asString(entry.lifecycle, "lazy")), LIFECYCLE_OPTIONS),
    number(`${prefix}idleTimeout`, "Idle timeout (minutes)", "Minutes before idle disconnect. Empty uses the global setting, 0 disables idle timeout.", value(`${prefix}idleTimeout`, entry.idleTimeout === undefined ? "" : String(entry.idleTimeout))),
    number(`${prefix}requestTimeoutMs`, "Request timeout (ms)", "Milliseconds before live requests time out. Empty or 0 uses the SDK default.", value(`${prefix}requestTimeoutMs`, entry.requestTimeoutMs === undefined ? "" : String(entry.requestTimeoutMs))),
    select(`${prefix}protocolVersion`, "MCP protocol era", "Legacy is the default. Auto offers 2026-07-28 with legacy fallback.", value(`${prefix}protocolVersion`, asString(entry.protocolVersion, "legacy")), PROTOCOL_OPTIONS),
    select(`${prefix}exposeResources`, "Expose resources", "Expose MCP resources as callable tools.", value(`${prefix}exposeResources`, booleanSelectValue(entry, "exposeResources")), BOOLEAN_OPTIONS),
    select(`${prefix}directTools`, "Direct tools", "Register tools individually instead of routing through the mcp proxy tool.", directMode, DIRECT_TOOLS_OPTIONS),
    textarea(`${prefix}directToolsList`, "Custom direct tools", "Tool names, one per line or a JSON array. Used only when Custom is selected above.", value(`${prefix}directToolsList`, formatList(entry.directTools))),
    select(`${prefix}toolPrefix`, "Tool prefix", "Prefix style for tools exposed by this server.", value(`${prefix}toolPrefix`, asString(entry.toolPrefix, "unset")), TOOL_PREFIX_OPTIONS),
    textarea(`${prefix}includeTools`, "Include tools", "Optional tool names or glob patterns. Empty includes all tools.", value(`${prefix}includeTools`, formatList(entry.includeTools))),
    textarea(`${prefix}excludeTools`, "Exclude tools", "Optional tool names or glob patterns to hide after includeTools.", value(`${prefix}excludeTools`, formatList(entry.excludeTools))),
    textarea(`${prefix}searchKeywords`, "Search keywords", 'Optional JSON object such as {"list_issues": ["github", "issues"]}.', value(`${prefix}searchKeywords`, formatRecord(entry.searchKeywords))),
    select(`${prefix}approveTools`, "Require approval", "Require interactive approval before calling matching tools.", value(`${prefix}approveTools`, booleanOrListMode(entry.approveTools)), DIRECT_TOOLS_OPTIONS),
    textarea(`${prefix}approveToolsList`, "Custom approval tools", "Tool names, one per line or a JSON array. Used only when Custom is selected above.", value(`${prefix}approveToolsList`, formatList(entry.approveTools))),
    toggle(`${prefix}debug`, "Show stderr", "Show the server's stderr in the Pi session log.", entry.debug === true),
    toggle(`${prefix}trace`, "Protocol trace", "Enable metadata-only JSONL protocol tracing for this server.", entry.trace === true),
    toggle(`${prefix}disabled`, "Disabled", "Keep this server configured but prevent connections and tool calls.", entry.disabled === true),
  ];
}

function serverCategory(api: AetherExtensionAPI, name: string, entry: AetherJsonObject, index: number, snapshot?: McpAetherSnapshot): AetherSettingsCategory {
  const selectedTransport = stored(api, `server:${name}:transport`, deriveTransport(entry));
  const transport: Transport = selectedTransport === "http" ? "http" : selectedTransport === "socket" ? "socket" : "stdio";
  const runtime = snapshot?.servers.find((server) => server.name === name);
  const status = runtime?.status ?? "not-connected";
  const toolText = runtime ? `${runtime.toolCount} tools` : "not initialized";
  const subtitle = `${transportLabel(transport)} · ${statusLabel(status)} · ${toolText}`;
  const value = (id: string, fallback: string) => stored(api, id, fallback);
  const settings: AetherSettingDefinition[] = [
    label(`server:${name}:runtime`, status === "failed" && runtime?.failedAgoSeconds !== undefined
      ? `Status: ${statusLabel(status)} ${runtime.failedAgoSeconds}s ago`
      : `Status: ${statusLabel(status)}`, `Runtime status reported by the Pi extension. ${runtime?.disabled ? "This server is disabled." : ""}`),
    select(`server:${name}:transport`, "Transport", "Switching transport clears the previous transport-specific fields.", value(`server:${name}:transport`, transport), TRANSPORT_OPTIONS),
    ...transportSettings(api, `server:${name}:`, transport, entry),
    ...commonSettings(api, `server:${name}:`, entry),
  ];
  const sections: AetherSettingsSection[] = [
    { id: "configuration", title: "Configuration", settings },
    {
      id: "actions",
      title: "Manage",
      settings: [
        text(`server:${name}:renameTo`, "Rename to", "Type the new name, then tap Rename server.", value(`server:${name}:renameTo`, "")),
        button(`server:${name}:rename`, "Rename server", "mcp:rename-server", { serverName: name }, "Rename this server and keep its configuration.", "neutral"),
        button(`server:${name}:reconnect`, "Reconnect", "mcp:reconnect-server", { serverName: name }, "Close and reconnect this server without reloading Pi.", "primary"),
        ...(transport === "http" && entry.auth !== false
          ? [
              button(`server:${name}:auth-start`, "Authenticate (OAuth)", "mcp:auth-start", { serverName: name }, "Start or continue the OAuth flow for this server.", "primary"),
              button(`server:${name}:logout-oauth`, "Clear OAuth credentials", "mcp:oauth-logout", { serverName: name }, "Remove stored OAuth credentials and close the connection.", "neutral"),
            ]
          : []),
        button(`server:${name}:remove`, "Remove server", "mcp:remove-server", { serverName: name }, "Remove this server from the Pi MCP config.", "danger"),
      ],
    },
  ];
  return {
    id: `server:${name}`,
    title: name,
    subtitle,
    icon: "auto",
    order: 20 + index,
    trailingIcon: "delete",
    trailingAction: "mcp:remove-server",
    trailingArgs: { serverName: name },
    sections,
  };
}

function newServerSection(api: AetherExtensionAPI): AetherSettingsSection {
  const value = (id: string, fallback: string) => stored(api, id, fallback);
  const transport = (value("new_transport", "stdio") === "http" ? "http" : value("new_transport", "stdio") === "socket" ? "socket" : "stdio") as Transport;
  const empty: AetherJsonObject = {};
  return {
    id: "new-server",
    title: "New MCP server",
    settings: [
      text("new_name", "Name", "Unique server name used as the config key and default tool prefix.", value("new_name", "")),
      select("new_transport", "Transport", "All transports supported by the MCP adapter.", transport, TRANSPORT_OPTIONS),
      ...transportSettings(api, "new_", transport, empty),
      ...commonSettings(api, "new_", empty),
      button("add-server", "Add MCP server", "mcp:add-server", {}, "Write this server to the Pi MCP config, then reload to connect.", "primary"),
    ],
  };
}

function buildMainSections(api: AetherExtensionAPI, servers: Record<string, AetherJsonObject>, snapshot: McpAetherSnapshot): AetherSettingsSection[] {
  const serverNames = Object.keys(servers).sort();
  const serverCount = serverNames.length;
  const sections: AetherSettingsSection[] = [];
  const readyText = snapshot.ready ? "ready" : "not initialized yet";

  if (serverCount === 0) {
    sections.push({
      id: "empty-state-section",
      settings: [
        {
          id: "no-servers-state",
          type: "empty-state",
          title: "No MCP servers",
          description: "Add HTTP or stdio servers to extend capabilities.",
          buttonLabel: "Add server",
          category: "new-server",
        },
      ],
    });
  } else {
    // Runtime status summary at the top
    sections.push({
      id: "runtime",
      title: "MCP Runtime",
      description: `Pi MCP bridge is ${readyText}. Config: ${snapshot.configPath}`,
      settings: [
        label("runtime-summary", `${serverCount} server${serverCount === 1 ? "" : "s"} configured · ${snapshot.connectedCount} connected · ${snapshot.totalTools} tools`, `Pi MCP bridge is ${readyText}. Config file: ${snapshot.configPath}`),
        {
          id: "runtime-actions",
          type: "action-row",
          actions: [
            { label: `Reload (${serverCount} servers)`, action: "mcp:reload" },
            { label: `Reconnect all (${snapshot.connectedCount} active)`, action: "mcp:reconnect-all" },
          ],
        },
      ],
    });

    // Server Cards section
    const serverCards: AetherSettingDefinition[] = serverNames.map((name) => {
      const entry = servers[name] as AetherJsonObject;
      const transport = deriveTransport(entry);
      const runtime = snapshot.servers.find((s) => s.name === name);
      const transportBadge = transport === "http" ? "STREAMABLE_HTTP" : transport === "socket" ? "UNIX_SOCKET" : "STDIO";
      const statusText = runtime?.status === "connected"
        ? "● connected"
        : runtime?.status === "failed"
        ? "▲ failed"
        : runtime?.status === "needs-auth"
        ? "🔑 auth required"
        : "○ not connected";
      const pillText = `${statusText} · ${runtime ? `${runtime.toolCount} tools` : "0 tools"}`;
      const inspectOutput = asString(api.storage.get(`mcp:inspect:${name}`), "");

      const details: Array<{ label: string; value: string }> = [
        { label: "Server ID", value: name },
        { label: "Transport", value: transportBadge },
      ];
      if (transport === "http") {
        details.push({ label: "URL", value: serverFieldValue(entry, "url") });
        details.push({ label: "Headers", value: String(Object.keys(entry.headers || {}).length) });
        if (entry.auth) details.push({ label: "Auth", value: authMode(entry) });
      } else if (transport === "stdio") {
        details.push({ label: "Command", value: serverFieldValue(entry, "command") });
        if (Array.isArray(entry.args) && entry.args.length > 0) {
          details.push({ label: "Arguments", value: entry.args.join(" ") });
        }
        if (entry.cwd) details.push({ label: "Working directory", value: String(entry.cwd) });
        if (entry.env && typeof entry.env === "object") {
          details.push({ label: "Environment", value: String(Object.keys(entry.env).length) });
        }
      } else {
        details.push({ label: "Socket path", value: serverFieldValue(entry, "socket") });
      }
      details.push({ label: "Lifecycle", value: asString(entry.lifecycle, "lazy") });
      details.push({
        label: "Request timeout",
        value: entry.requestTimeoutMs !== undefined ? `${entry.requestTimeoutMs} ms` : "SDK default",
      });

      const actions: Array<{ label: string; action: string; args?: AetherJsonObject; tone?: "primary" | "neutral" | "danger" }> = [
        { label: "Tools", action: "mcp:inspect-tools", args: { serverName: name } },
        { label: "Resources", action: "mcp:inspect-resources", args: { serverName: name } },
        { label: "Prompts", action: "mcp:inspect-prompts", args: { serverName: name } },
        { label: "Reconnect", action: "mcp:reconnect-server", args: { serverName: name } },
      ];
      if (transport === "http" && entry.auth !== false) {
        actions.push({ label: "OAuth", action: "mcp:auth-start", args: { serverName: name } });
      }

      return {
        id: `card_${name}`,
        type: "item-card",
        title: name,
        subtitle: transportBadge,
        pill: pillText,
        checked: entry.disabled !== true,
        toggleAction: "mcp:toggle-server",
        editCategory: `server:${name}`,
        deleteAction: "mcp:remove-server",
        deleteArgs: { serverName: name },
        actions,
        details,
        ...(inspectOutput ? { resultText: inspectOutput } : {}),
      };
    });

    sections.push({
      id: "servers",
      title: "Configured Servers",
      description: "Tap any server to view details, inspect available tools, or reconnect.",
      settings: serverCards,
    });
  }

  // Pending OAuth section if any
  const pendingOAuth = oauthSection(api);
  if (pendingOAuth) sections.push(pendingOAuth);

  return sections;
}

function oauthSection(api: AetherExtensionAPI): AetherSettingsSection | undefined {
  const pending = api.storage.get<AetherJsonObject>(BRIDGE_OAUTH_KEY);
  if (!pending || typeof pending.serverName !== "string") return undefined;
  const authorizationUrl = asString(pending.authorizationUrl);
  if (!authorizationUrl) return undefined;
  const value = stored(api, "oauth-input", "");
  return {
    id: "oauth",
    title: "MCP OAuth",
    settings: [
      label("oauth-summary", `Authorize ${pending.serverName}`, "Open the authorization URL, approve access, then paste the full callback URL or code back here."),
      link("oauth-url", "Open authorization URL", authorizationUrl, "The browser may not be able to reach the localhost callback from another device; paste the redirect URL manually below."),
      textarea("oauth-input", "Callback URL or authorization code", "Paste the full URL from the browser address bar after approving access.", value),
      button("oauth-complete", "Complete OAuth", "mcp:oauth-complete", { serverName: pending.serverName }, "Exchange the authorization code and reconnect the server.", "primary"),
    ],
  };
}

function transportLabel(transport: Transport): string {
  if (transport === "stdio") return "stdio";
  if (transport === "socket") return "unix socket";
  return "http";
}

function statusLabel(status: McpAetherServerSnapshot["status"]): string {
  return status.replaceAll("-", " ");
}

function emptySnapshot(): McpAetherSnapshot {
  return {
    ready: false,
    configPath: configPath(),
    servers: [],
    totalTools: 0,
    totalResources: 0,
    connectedCount: 0,
    disabledCount: 0,
  };
}

// ---------------------------------------------------------------------------
// Server mutation helpers
// ---------------------------------------------------------------------------

function parseOAuthObject(api: AetherExtensionAPI, prefix: string, existing: AetherJsonObject, force: boolean): AetherJsonObject | undefined {
  const value = (id: string) => stored(api, id, "");
  const clientId = stringValue(value(`${prefix}oauthClientId`), true);
  const clientSecret = stringValue(value(`${prefix}oauthClientSecret`), true);
  const scope = stringValue(value(`${prefix}oauthScope`), true);
  const redirectUri = stringValue(value(`${prefix}oauthRedirectUri`), true);
  const clientName = stringValue(value(`${prefix}oauthClientName`), true);
  const clientUri = stringValue(value(`${prefix}oauthClientUri`), true);
  const logoUri = stringValue(value(`${prefix}oauthLogoUri`), true);
  const grantType = value(`${prefix}oauthGrantType`);
  const skipIssuer = storedBoolean(api, `${prefix}oauthSkipIssuerValidation`, false);
  const authorizationParams = parseRecord(value(`${prefix}oauthAuthorizationParams`), "OAuth authorizationParams");
  const previous = existing.oauth && typeof existing.oauth === "object" && !Array.isArray(existing.oauth)
    ? existing.oauth as AetherJsonObject
    : {};
  const next: AetherJsonObject = { ...previous };
  if (grantType !== "default" && grantType !== "") next.grantType = grantType;
  else delete next.grantType;
  if (clientId !== undefined) next.clientId = clientId; else delete next.clientId;
  if (clientSecret !== undefined) next.clientSecret = clientSecret; else delete next.clientSecret;
  if (scope !== undefined) next.scope = scope; else delete next.scope;
  if (redirectUri !== undefined) next.redirectUri = redirectUri; else delete next.redirectUri;
  if (clientName !== undefined) next.clientName = clientName; else delete next.clientName;
  if (clientUri !== undefined) next.clientUri = clientUri; else delete next.clientUri;
  if (logoUri !== undefined) next.logoUri = logoUri; else delete next.logoUri;
  if (skipIssuer) next.skipIssuerMetadataValidation = true; else delete next.skipIssuerMetadataValidation;
  if (authorizationParams !== undefined) next.authorizationParams = authorizationParams; else delete next.authorizationParams;
  return (force || Object.keys(next).length > 0) ? next : undefined;
}

function applyText(entry: AetherJsonObject, field: string, raw: unknown): void {
  const value = asString(raw);
  const next = stringValue(value, true);
  if (next !== undefined) entry[field] = next;
  else delete entry[field];
}

function applyInteger(entry: AetherJsonObject, field: string, raw: unknown): void {
  const value = integerValue(asString(raw), true);
  if (value !== undefined) entry[field] = value;
  else delete entry[field];
}

function applyList(entry: AetherJsonObject, field: string, raw: unknown, labelText: string): void {
  const value = parseList(asString(raw), labelText);
  if (value !== undefined) entry[field] = value;
  else delete entry[field];
}

function applyRecord(entry: AetherJsonObject, field: string, raw: unknown, labelText: string): void {
  const value = parseRecord(asString(raw), labelText);
  if (value !== undefined) entry[field] = value;
  else delete entry[field];
}

function applyServerField(api: AetherExtensionAPI, serverName: string, field: string, raw: unknown): boolean {
  const servers = readServers();
  const entry = servers[serverName];
  if (!entry) throw new Error(`Server "${serverName}" no longer exists.`);
  const next: AetherJsonObject = { ...entry };
  const value = asString(raw);
  const prefix = `server:${serverName}:`;

  switch (field) {
    case "transport":
      for (const key of ["command", "args", "env", "cwd", "url", "headers", "requestHeadersCommand", "auth", "bearerToken", "bearerTokenEnv", "oauth", "socket"]) delete next[key];
      break;
    case "command":
    case "url":
    case "socket":
    case "cwd":
    case "bearerToken":
    case "bearerTokenEnv":
      applyText(next, field, raw);
      break;
    case "args":
      applyList(next, "args", raw, "Arguments");
      break;
    case "env":
    case "headers":
      applyRecord(next, field, raw, field === "env" ? "Environment" : "HTTP headers");
      break;
    case "httpTransport": {
      const selected = value === "streamable-http" || value === "sse" ? value : "auto";
      if (selected === "auto") delete next.httpTransport;
      else next.httpTransport = selected;
      break;
    }
    case "auth": {
      if (value === "oauth") {
        next.auth = "oauth";
        delete next.bearerToken;
        delete next.bearerTokenEnv;
        next.oauth = parseOAuthObject(api, prefix, next, true) ?? {};
      } else if (value === "bearer") {
        next.auth = "bearer";
        delete next.bearerTokenEnv;
        delete next.oauth;
      } else if (value === "none") {
        next.auth = false;
        delete next.bearerToken;
        delete next.bearerTokenEnv;
        delete next.oauth;
      } else {
        delete next.auth;
        delete next.bearerToken;
        delete next.bearerTokenEnv;
      }
      break;
    }
    case "oauthGrantType":
    case "oauthClientId":
    case "oauthClientSecret":
    case "oauthScope":
    case "oauthRedirectUri":
    case "oauthClientName":
    case "oauthClientUri":
    case "oauthLogoUri":
    case "oauthSkipIssuerValidation":
    case "oauthAuthorizationParams":
      next.oauth = parseOAuthObject(api, prefix, next, false);
      break;
    case "requestHeadersCommand": {
      const trimmed = value.trim();
      if (!trimmed) delete next.requestHeadersCommand;
      else {
        const parsed = JSON.parse(stripJsonComments(trimmed, { trailingCommas: true }));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("requestHeadersCommand must be a JSON object.");
        next.requestHeadersCommand = parsed;
      }
      break;
    }
    case "lifecycle": {
      if (value === "lazy" || value === "eager" || value === "keep-alive" || value === "lazy-keep-alive") next.lifecycle = value;
      else delete next.lifecycle;
      break;
    }
    case "idleTimeout":
      applyInteger(next, "idleTimeout", raw);
      break;
    case "requestTimeoutMs":
      applyInteger(next, "requestTimeoutMs", raw);
      break;
    case "protocolVersion": {
      if (value === "auto" || value === "2026-07-28") next.protocolVersion = value;
      else if (value === "legacy") next.protocolVersion = "legacy";
      else delete next.protocolVersion;
      break;
    }
    case "exposeResources": {
      if (value === "true") next.exposeResources = true;
      else if (value === "false") next.exposeResources = false;
      else delete next.exposeResources;
      break;
    }
    case "directTools": {
      if (value === "all") next.directTools = true;
      else if (value === "proxy-only") next.directTools = false;
      else if (value === "custom") {
        const list = parseList(stored(api, `${prefix}directToolsList`, ""), "Custom direct tools");
        if (list !== undefined) next.directTools = list;
        else delete next.directTools;
      } else delete next.directTools;
      break;
    }
    case "toolPrefix": {
      if (value === "server" || value === "short" || value === "none" || value === "mcp") next.toolPrefix = value;
      else delete next.toolPrefix;
      break;
    }
    case "includeTools":
      applyList(next, "includeTools", raw, "Include tools");
      break;
    case "excludeTools":
      applyList(next, "excludeTools", raw, "Exclude tools");
      break;
    case "searchKeywords": {
      const parsed = parseKeywordRecord(value);
      if (parsed !== undefined) next.searchKeywords = parsed;
      else delete next.searchKeywords;
      break;
    }
    case "approveTools": {
      if (value === "all") next.approveTools = true;
      else if (value === "proxy-only") next.approveTools = false;
      else if (value === "custom") {
        const list = parseList(stored(api, `${prefix}approveToolsList`, ""), "Custom approval tools");
        if (list !== undefined) next.approveTools = list;
        else delete next.approveTools;
      } else delete next.approveTools;
      break;
    }
    case "debug":
    case "trace":
    case "disabled":
      if (booleanValue(raw)) next[field] = true;
      else delete next[field];
      break;
    default:
      return false;
  }

  writeServers({ ...servers, [serverName]: next });
  return true;
}

function buildEntryFromForm(api: AetherExtensionAPI, name: string, transport: Transport): AetherJsonObject {
  const entry: AetherJsonObject = {};
  const value = (id: string) => stored(api, id, "");
  if (transport === "stdio") {
    const command = value("new_command").trim();
    if (!command) throw new Error("Command is required for a stdio server.");
    entry.command = command;
    const args = parseList(value("new_args"), "Arguments");
    if (args !== undefined) entry.args = args;
    const env = parseRecord(value("new_env"), "Environment");
    if (env !== undefined) entry.env = env;
    const cwd = stringValue(value("new_cwd"), true);
    if (cwd !== undefined) entry.cwd = cwd;
  } else if (transport === "http") {
    const url = value("new_url").trim();
    if (!url) throw new Error("URL is required for an HTTP MCP server.");
    entry.url = url;
    const httpTransport = value("new_httpTransport");
    if (httpTransport === "streamable-http" || httpTransport === "sse") entry.httpTransport = httpTransport;
    const auth = value("new_auth");
    if (auth === "oauth") {
      entry.auth = "oauth";
      entry.oauth = parseOAuthObject(api, "new_", entry, true) ?? {};
    } else if (auth === "bearer") {
      entry.auth = "bearer";
    } else if (auth === "none") {
      entry.auth = false;
    } else {
      const oauth = parseOAuthObject(api, "new_", entry, false);
      if (oauth !== undefined) entry.oauth = oauth;
    }
    const bearerToken = stringValue(value("new_bearerToken"), true);
    if (bearerToken !== undefined) entry.bearerToken = bearerToken;
    const bearerTokenEnv = stringValue(value("new_bearerTokenEnv"), true);
    if (bearerTokenEnv !== undefined) entry.bearerTokenEnv = bearerTokenEnv;
    const headers = parseRecord(value("new_headers"), "HTTP headers");
    if (headers !== undefined) entry.headers = headers;
    const requestHeadersCommand = stringValue(value("new_requestHeadersCommand"), true);
    if (requestHeadersCommand !== undefined) {
      const parsed = JSON.parse(stripJsonComments(requestHeadersCommand, { trailingCommas: true }));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("requestHeadersCommand must be a JSON object.");
      entry.requestHeadersCommand = parsed;
    }
  } else {
    const socket = value("new_socket").trim();
    if (!socket) throw new Error("Socket path is required for a Unix socket server.");
    entry.socket = socket;
  }

  const lifecycle = value("new_lifecycle");
  if (lifecycle === "eager" || lifecycle === "keep-alive" || lifecycle === "lazy-keep-alive" || lifecycle === "lazy") entry.lifecycle = lifecycle;
  const idleTimeout = integerValue(value("new_idleTimeout"), true);
  if (idleTimeout !== undefined) entry.idleTimeout = idleTimeout;
  const requestTimeoutMs = integerValue(value("new_requestTimeoutMs"), true);
  if (requestTimeoutMs !== undefined) entry.requestTimeoutMs = requestTimeoutMs;
  const protocolVersion = value("new_protocolVersion");
  if (protocolVersion === "auto" || protocolVersion === "2026-07-28" || protocolVersion === "legacy") entry.protocolVersion = protocolVersion;
  const exposeResources = value("new_exposeResources");
  if (exposeResources === "true") entry.exposeResources = true;
  if (exposeResources === "false") entry.exposeResources = false;
  const directTools = value("new_directTools");
  if (directTools === "all") entry.directTools = true;
  if (directTools === "proxy-only") entry.directTools = false;
  if (directTools === "custom") {
    const list = parseList(value("new_directToolsList"), "Custom direct tools");
    if (list !== undefined) entry.directTools = list;
  }
  const toolPrefix = value("new_toolPrefix");
  if (toolPrefix === "server" || toolPrefix === "short" || toolPrefix === "none" || toolPrefix === "mcp") entry.toolPrefix = toolPrefix;
  const includeTools = parseList(value("new_includeTools"), "Include tools");
  if (includeTools !== undefined) entry.includeTools = includeTools;
  const excludeTools = parseList(value("new_excludeTools"), "Exclude tools");
  if (excludeTools !== undefined) entry.excludeTools = excludeTools;
  const searchKeywords = parseKeywordRecord(value("new_searchKeywords"));
  if (searchKeywords !== undefined) entry.searchKeywords = searchKeywords;
  const approveTools = value("new_approveTools");
  if (approveTools === "all") entry.approveTools = true;
  if (approveTools === "proxy-only") entry.approveTools = false;
  if (approveTools === "custom") {
    const list = parseList(value("new_approveToolsList"), "Custom approval tools");
    if (list !== undefined) entry.approveTools = list;
  }
  if (storedBoolean(api, "new_debug", false)) entry.debug = true;
  if (storedBoolean(api, "new_trace", false)) entry.trace = true;
  if (storedBoolean(api, "new_disabled", false)) entry.disabled = true;
  return entry;
}

function clearNewServerForm(api: AetherExtensionAPI): void {
  for (const key of Object.keys(api.storage.snapshot())) {
    if (key.startsWith("new_") || key.startsWith(settingStorageKey("new_"))) api.storage.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Aether Script Mod entrypoint
// ---------------------------------------------------------------------------

const MCP_TOOL_TITLES = [
  ["mcp", "Calling MCP", "Called MCP"],
  ["mcpScript", "Running MCP script", "Ran MCP script"],
] as const;

export const activateAether = async (aether: AetherExtensionAPI) => {
  for (const [toolName, runningTitle, completedTitle] of MCP_TOOL_TITLES) {
    aether.registerToolTitle?.(toolName, runningTitle, completedTitle, 200);
  }
  const staticToolNames = new Set<string>(MCP_TOOL_TITLES.map(([toolName]) => toolName));
  const dynamicToolTitleCleanups = new Map<string, () => void>();
  const syncDynamicToolTitles = () => {
    const toolNames = readMcpAetherBridge()?.getSnapshot().toolNames ?? [];
    const current = new Set(toolNames);
    for (const [toolName, cleanup] of dynamicToolTitleCleanups) {
      if (current.has(toolName)) continue;
      cleanup();
      dynamicToolTitleCleanups.delete(toolName);
    }
    for (const toolName of current) {
      if (staticToolNames.has(toolName) || dynamicToolTitleCleanups.has(toolName)) continue;
      const cleanup = aether.registerToolTitle?.(toolName, `Calling ${toolName}`, `Called ${toolName}`, 100);
      if (typeof cleanup === "function") dynamicToolTitleCleanups.set(toolName, cleanup);
    }
  };
  syncDynamicToolTitles();
  let unregisterSettings: (() => void) | undefined;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let lastFingerprint = "";
  let seeded = false;


// ---------------------------------------------------------------------------
  const pageFingerprint = (servers: Record<string, AetherJsonObject>, snapshot: McpAetherSnapshot, pendingOAuth: boolean): string => JSON.stringify({
    path: snapshot.configPath,
    ready: snapshot.ready,
    pendingOAuth,
    servers: Object.keys(servers).sort().map((name) => [name, deriveTransport(servers[name] as AetherJsonObject)]),
    statuses: snapshot.servers.map((server) => [server.name, server.status, server.toolCount, server.resourceCount ?? null, server.failedAgoSeconds ?? null, server.disabled]),
    totals: [snapshot.totalTools, snapshot.totalResources, snapshot.connectedCount, snapshot.disabledCount],
    inspections: Object.keys(servers).map((name) => [name, asString(aether.storage.get(`mcp:inspect:${name}`), "")]),
  });

  const registerSettingActions = (definition: { sections?: AetherSettingsSection[]; categories?: AetherSettingsCategory[] }) => {
    const sections = [...(definition.sections ?? []), ...(definition.categories ?? []).flatMap((category) => category.sections)];
    const seen = new Set<string>();
    for (const section of sections) {
      for (const setting of section.settings) {
        const type = setting.type ?? "text";
        if (type === "button" || type === "link" || type === "label" || type === "divider" || type === "spacer" || type === "item-card" || type === "empty-state" || type === "action-row") continue;
        if (seen.has(setting.id)) continue;
        seen.add(setting.id);
        aether.registerAction(`settings:${PAGE_ID}:${setting.id}`, async (payload) => {
          const raw = payload.value !== undefined ? payload.value : payload.checked;
          const current: string | number | boolean =
            typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean" ? raw : "";
          if (setting.id.startsWith("new_")) {
            storeSetting(aether, setting.id, current);
            if (setting.id === "new_transport") scheduleRefresh(true);
            return { setting: setting.id, value: current };
          }
          if (setting.id.startsWith("server:")) {
            const separator = setting.id.indexOf(":", "server:".length);
            if (separator === -1) return { setting: setting.id, value: current };
            const serverName = setting.id.slice("server:".length, separator);
            const field = setting.id.slice(separator + 1);
            storeSetting(aether, setting.id, current);
            try {
              if (field === "renameTo") return { setting: setting.id, value: current };
              const changed = applyServerField(aether, serverName, field, current);
              if (!changed) return { setting: setting.id, value: current };
              if (field === "transport") scheduleRefresh(true);
              return { setting: setting.id, value: current };
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              return { setting: setting.id, error: message };
            }
          }
          storeSetting(aether, setting.id, current);
          return { setting: setting.id, value: current };
        });
      }
    }
  };

  const registerPage = (force: boolean) => {
    let servers: Record<string, AetherJsonObject>;
    try {
      servers = readServers();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      aether.notify(message, "error");
      servers = {};
    }
    const snapshot = readMcpAetherBridge()?.getSnapshot() ?? emptySnapshot();
    const pendingOAuth = Boolean(aether.storage.get<AetherJsonObject>(BRIDGE_OAUTH_KEY));
    const fingerprint = pageFingerprint(servers, snapshot, pendingOAuth);
    if (!force && fingerprint === lastFingerprint) return;
    lastFingerprint = fingerprint;

    const definition: AetherSettingsDefinition = {
      id: PAGE_ID,
      title: "MCP Servers",
      subtitle: "Manage MCP servers, inspect each transport config, and keep only the connections you want active.",
      icon: "auto",
      order: 30,
      trailingIcon: "add",
      trailingCategory: "new-server",
      sections: buildMainSections(aether, servers, snapshot),
      categories: [
        {
          id: "new-server",
          title: "Add MCP server",
          subtitle: `Writes to ${snapshot.configPath}`,
          icon: "auto",
          order: 10,
          trailingIcon: "none",
          hidden: true,
          sections: [newServerSection(aether)],
        },
        ...Object.keys(servers).sort().map((name, index) => serverCategory(aether, name, servers[name] as AetherJsonObject, index, snapshot)),
      ],
    };

    if (!seeded) {
      for (const section of [...(definition.sections ?? []), ...(definition.categories ?? []).flatMap((category) => category.sections)]) {
        for (const setting of section.settings) {
          if (setting.default === undefined) continue;
          const existing = aether.storage.get(settingStorageKey(setting.id)) ?? aether.storage.get(setting.id);
          const preserveDraft = setting.id.startsWith("new_") || setting.id === "oauth-input";
          if (!preserveDraft || existing === undefined || existing === null) {
            storeSetting(aether, setting.id, setting.default);
          }
        }
      }
      seeded = true;
    }

    unregisterSettings?.();
    try {
      unregisterSettings = aether.registerSettings(definition);
    } catch {
      unregisterSettings = aether.registerSettings({
        id: definition.id,
        title: definition.title,
        ...(definition.subtitle !== undefined ? { subtitle: definition.subtitle } : {}),
        ...(definition.icon !== undefined ? { icon: definition.icon } : {}),
        ...(definition.order !== undefined ? { order: definition.order } : {}),
        categories: [
          {
            id: "general",
            title: "MCP",
            subtitle: "Runtime and OAuth",
            icon: "auto",
            order: 1,
            sections: definition.sections ?? [],
          },
          ...(definition.categories ?? []),
        ],
      });
    }
    registerSettingActions(definition);
  };

  const scheduleRefresh = (force = false) => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined;
      registerPage(force);
    }, force ? 0 : 150);
  };

  aether.registerAction("mcp:toggle-server", async (payload) => {
    try {
      const id = asString(payload.setting);
      const serverName = id.startsWith("card_") ? id.slice("card_".length) : id;
      const checked = payload.checked !== undefined ? Boolean(payload.checked) : payload.value !== false;
      const servers = readServers();
      const entry = servers[serverName];
      if (!entry) throw new Error(`Server "${serverName}" not found.`);
      if (checked) {
        delete entry.disabled;
      } else {
        entry.disabled = true;
      }
      writeServers({ ...servers, [serverName]: entry });
      aether.notify(`MCP server "${serverName}" ${checked ? "enabled" : "disabled"}.`, "info");
      scheduleRefresh(true);
      return { ok: true, name: serverName, enabled: checked };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      aether.notify(`MCP: ${message}`, "error");
      return { ok: false, error: message };
    }
  });

  const handleInspect = async (serverName: string, kind: "tools" | "resources" | "prompts") => {
    try {
      const result = await withBridge((bridge) => bridge.inspect(serverName, kind), "The Pi MCP extension is not loaded yet.");
      const details = result.details || result.message;
      aether.storage.set(`mcp:inspect:${serverName}`, details);
      aether.notify(result.message, result.ok ? "info" : "warning");
      scheduleRefresh(true);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      aether.storage.set(`mcp:inspect:${serverName}`, `Inspection failed: ${message}`);
      aether.notify(`MCP: ${message}`, "error");
      scheduleRefresh(true);
      return { ok: false, error: message };
    }
  };

  aether.registerAction("mcp:inspect-tools", async (payload) => {
    const name = validateServerName(asString(payload.serverName));
    return handleInspect(name, "tools");
  });

  aether.registerAction("mcp:inspect-resources", async (payload) => {
    const name = validateServerName(asString(payload.serverName));
    return handleInspect(name, "resources");
  });

  aether.registerAction("mcp:inspect-prompts", async (payload) => {
    const name = validateServerName(asString(payload.serverName));
    return handleInspect(name, "prompts");
  });

  aether.registerAction("mcp:add-server", async () => {
    try {
      const name = validateServerName(stored(aether, "new_name", ""));
      const transportRaw = stored(aether, "new_transport", "stdio");
      const transport: Transport = transportRaw === "http" ? "http" : transportRaw === "socket" ? "socket" : "stdio";
      const servers = readServers();
      if (servers[name]) throw new Error(`Server "${name}" already exists.`);
      const entry = buildEntryFromForm(aether, name, transport);
      writeServers({ ...servers, [name]: entry });
      clearNewServerForm(aether);
      aether.notify(`MCP server "${name}" added. Tap Reload MCP extension to connect.`, "info");
      scheduleRefresh(true);
      return { ok: true, name };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      aether.notify(`MCP: ${message}`, "error");
      return { ok: false, error: message };
    }
  });

  aether.registerAction("mcp:remove-server", async (payload) => {
    try {
      const name = validateServerName(asString(payload.serverName));
      const servers = readServers();
      if (!servers[name]) throw new Error(`Server "${name}" does not exist in ${configPath()}.`);
      delete servers[name];
      writeServers(servers);
      clearServerStorage(aether, name);
      aether.notify(`MCP server "${name}" removed. Tap Reload MCP extension to apply.`, "info");
      scheduleRefresh(true);
      return { ok: true, name };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      aether.notify(`MCP: ${message}`, "error");
      return { ok: false, error: message };
    }
  });

  aether.registerAction("mcp:rename-server", async (payload) => {
    try {
      const name = validateServerName(asString(payload.serverName));
      const nextName = validateServerName(stored(aether, `server:${name}:renameTo`, ""));
      const servers = readServers();
      if (!servers[name]) throw new Error(`Server "${name}" does not exist.`);
      if (servers[nextName]) throw new Error(`Server "${nextName}" already exists.`);
      writeServers({ ...Object.fromEntries(Object.entries(servers).filter(([key]) => key !== name)), [nextName]: servers[name] as AetherJsonObject });
      clearServerStorage(aether, name);
      aether.notify(`MCP server "${name}" renamed to "${nextName}". Tap Reload MCP extension to apply.`, "info");
      scheduleRefresh(true);
      return { ok: true, name: nextName };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      aether.notify(`MCP: ${message}`, "error");
      return { ok: false, error: message };
    }
  });

  const withBridge = async <T>(operation: (bridge: McpAetherBridge) => Promise<T>, missingMessage: string): Promise<T> => {
    const bridge = readMcpAetherBridge();
    if (!bridge) throw new Error(missingMessage);
    return operation(bridge);
  };

  aether.registerAction("mcp:reload", async () => {
    try {
      const result = await withBridge((bridge) => bridge.reload(), "The Pi MCP extension is not loaded yet.");
      if (result.ok) aether.notify("MCP extension reloading.", "info");
      else aether.notify(`MCP: ${result.message}`, "warning");
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      aether.notify(`MCP: ${message}`, "error");
      return { ok: false, error: message };
    }
  });

  aether.registerAction("mcp:reconnect-all", async () => {
    try {
      const result = await withBridge((bridge) => bridge.reconnectAll(), "The Pi MCP extension is not loaded yet.");
      aether.notify(result.message, result.ok ? "info" : "warning");
      scheduleRefresh(true);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      aether.notify(`MCP: ${message}`, "error");
      return { ok: false, error: message };
    }
  });

  aether.registerAction("mcp:reconnect-server", async (payload) => {
    try {
      const name = validateServerName(asString(payload.serverName));
      const result = await withBridge((bridge) => bridge.reconnect(name), "The Pi MCP extension is not loaded yet.");
      aether.notify(result.message, result.ok ? "info" : "warning");
      scheduleRefresh(true);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      aether.notify(`MCP: ${message}`, "error");
      return { ok: false, error: message };
    }
  });

  aether.registerAction("mcp:auth-start", async (payload) => {
    try {
      const name = validateServerName(asString(payload.serverName));
      const result = await withBridge((bridge) => bridge.startAuth(name), "The Pi MCP extension is not loaded yet.");
      if (result.ok && result.authorizationUrl) {
        aether.storage.set(BRIDGE_OAUTH_KEY, { serverName: name, authorizationUrl: result.authorizationUrl, startedAt: Date.now() });
        clearSetting(aether, "oauth-input");
        aether.notify("Authorization URL ready. Open it, approve access, then paste the callback URL back here.", "info");
      } else {
        aether.notify(result.message, result.ok ? "info" : "warning");
      }
      scheduleRefresh(true);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      aether.notify(`MCP: ${message}`, "error");
      return { ok: false, error: message };
    }
  });

  aether.registerAction("mcp:oauth-complete", async (payload) => {
    try {
      const name = validateServerName(asString(payload.serverName));
      const input = stored(aether, "oauth-input", "").trim();
      if (!input) throw new Error("Paste the full callback URL or authorization code first.");
      const result = await withBridge((bridge) => bridge.completeAuth(name, input), "The Pi MCP extension is not loaded yet.");
      aether.storage.delete(BRIDGE_OAUTH_KEY);
      clearSetting(aether, "oauth-input");
      aether.notify(result.message, result.ok ? "info" : "warning");
      scheduleRefresh(true);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      aether.notify(`MCP: ${message}`, "error");
      return { ok: false, error: message };
    }
  });

  aether.registerAction("mcp:oauth-logout", async (payload) => {
    try {
      const name = validateServerName(asString(payload.serverName));
      const result = await withBridge((bridge) => bridge.logout(name), "The Pi MCP extension is not loaded yet.");
      aether.notify(result.message, result.ok ? "info" : "warning");
      scheduleRefresh(true);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      aether.notify(`MCP: ${message}`, "error");
      return { ok: false, error: message };
    }
  });


  registerPage(true);
  attachMcpAetherApi(aether, () => {
    syncDynamicToolTitles();
    scheduleRefresh(true);
  });

  return () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    for (const cleanup of dynamicToolTitleCleanups.values()) cleanup();
    dynamicToolTitleCleanups.clear();
    unregisterSettings?.();
  };
};
