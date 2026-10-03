import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getWebSearchConfigPath } from "./utils.ts";

type AetherJsonObject = Record<string, unknown>;
type AetherView = AetherJsonObject | AetherView[] | string | null | undefined;
type AetherRenderContext = AetherJsonObject & { storage: AetherJsonObject };
type AetherSettingDefinition = {
	id: string;
	label: string;
	description?: string;
	type?: "text" | "number" | "toggle" | "select" | "slider" | "password";
	default?: string | number | boolean;
	placeholder?: string;
	options?: Array<{ value: string; label: string }>;
	min?: number;
	max?: number;
	step?: number;
};
type AetherSettingsSection = {
	id?: string;
	title?: string;
	description?: string;
	settings: AetherSettingDefinition[];
};
type AetherSettingsCategory = {
	id: string;
	title: string;
	subtitle?: string;
	icon?: string;
	order?: number;
	sections: AetherSettingsSection[];
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
	registerSettings(definition: {
		id: string;
		title: string;
		subtitle?: string;
		icon?: string;
		order?: number;
		sections?: AetherSettingsSection[];
		categories?: AetherSettingsCategory[];
	}): () => void;
	registerMessageType(definition: AetherMessageTypeDefinition): () => void;
	registerComposerMenuItem(definition: AetherJsonObject & { id: string; title: string }): () => void;
	registerSurface(slot: string, definition: AetherJsonObject & {
		render?: AetherView | ((context: AetherRenderContext) => AetherView | Promise<AetherView>);
	}): () => void;
	registerAction(id: string, handler: (payload: AetherJsonObject) => unknown | Promise<unknown>): () => void;
	registerToolTitle?(toolName: string, runningTitle: string, completedTitle: string, priority?: number): () => void;
};

const SETTINGS_PAGE_ID = "web-access-settings";
const BRIDGE_KEY = Symbol.for("pi-web-access.aether-bridge");

type SettingValue = string | number | boolean;
type WebAccessBridge = {
	api: AetherExtensionAPI;
};

type ConfigBinding = {
	setting: AetherSettingDefinition;
	path: string[];
	defaultValue: SettingValue;
	sensitive?: boolean;
	fromConfig?: (value: unknown) => SettingValue;
	toConfig?: (value: SettingValue) => unknown;
	apply?: (config: Record<string, unknown>, value: SettingValue) => void;
};

const providerOptions = [
	["auto", "Auto"],
	["all", "All eligible providers"],
	["openai", "OpenAI"],
	["brave", "Brave"],
	["parallel", "Parallel"],
	["tinyfish", "TinyFish"],
	["search1api", "Search1API"],
	["searchinfinity", "Searchinfinity"],
	["querit", "Querit"],
	["tavily", "Tavily"],
	["serpdive", "SERPdive"],
	["kagi", "Kagi"],
	["ollama", "Ollama Cloud"],
	["searxng", "SearXNG"],
	["exa", "Exa"],
	["perplexity", "Perplexity"],
	["gemini", "Gemini"],
	["anysearch", "AnySearch"],
	["xai", "xAI"],
	["brightdata", "Bright Data"],
	["serpbase", "SerpBase"],
].map(([value, label]) => ({ value, label }));

const routedProviders = providerOptions
	.map((option) => option.value)
	.filter((provider) => provider !== "auto" && provider !== "all");

function commaSeparated(value: unknown): string {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join(", ") : "";
}

function parseProviderRoute(value: SettingValue): string[] {
	const providers = String(value).split(",").map((part) => part.trim().toLowerCase()).filter(Boolean);
	const invalid = providers.find((provider) => !routedProviders.includes(provider));
	if (invalid) throw new Error(`Unknown search provider in route: ${invalid}`);
	if (new Set(providers).size !== providers.length) throw new Error("Sequential provider route must not contain duplicates.");
	return providers;
}

const webSearchEnabledBinding: ConfigBinding = {
	setting: {
		id: "webSearchEnabled",
		label: "Web search tools",
		description: "Register search and source-check tools after the next extension reload.",
		type: "toggle",
	},
	path: ["webSearch", "enabled"],
	defaultValue: true,
};

const providerBinding: ConfigBinding = {
	setting: {
		id: "provider",
		label: "Default search provider",
		description: "Used whenever a tool call leaves provider on Auto.",
		type: "select",
		options: providerOptions,
	},
	path: ["provider"],
	defaultValue: "auto",
	toConfig: (value) => value === "auto" ? "" : value,
};

const advancedCoreBindings: ConfigBinding[] = [
	{
		setting: {
			id: "searchRoutingProviders",
			label: "Sequential fallback route",
			description: "Comma-separated providers in priority order. Saving a route clears the single-provider override and uses transient, quota, and network fallbacks by default.",
			type: "text",
			placeholder: "openai, brave, exa",
		},
		path: ["searchRouting", "providers"],
		defaultValue: "",
		fromConfig: commaSeparated,
		apply: (config, value) => {
			const providers = parseProviderRoute(value);
			if (providers.length === 0) {
				delete config.searchRouting;
				return;
			}
			const current = config.searchRouting && typeof config.searchRouting === "object" && !Array.isArray(config.searchRouting)
				? config.searchRouting as Record<string, unknown>
				: {};
			const fallbackOn = Array.isArray(current.fallbackOn) && current.fallbackOn.length > 0
				? current.fallbackOn
				: ["transient", "quota", "network"];
			config.searchRouting = { ...current, providers, fallbackOn };
			delete config.provider;
			delete config.searchProvider;
		},
	},
	{
		setting: {
			id: "workflow",
			label: "Result workflow",
			description: "Review a draft, return an automatic summary, or return raw results.",
			type: "select",
			options: [
				{ value: "summary-review", label: "Summary review" },
				{ value: "auto-summary", label: "Automatic summary" },
				{ value: "none", label: "Raw results" },
			],
		},
		path: ["workflow"],
		defaultValue: "summary-review",
	},
	{
		setting: {
			id: "curatorTimeoutSeconds",
			label: "Curator idle timeout",
			description: "Seconds before an idle review is submitted automatically.",
			type: "number",
			min: 10,
			max: 600,
		},
		path: ["curatorTimeoutSeconds"],
		defaultValue: 20,
	},
	{
		setting: {
			id: "autoOpenBrowser",
			label: "Open curator automatically",
			description: "Open the review UI when a local search starts.",
			type: "toggle",
		},
		path: ["autoOpenBrowser"],
		defaultValue: true,
	},
];

type ProviderSectionDefinition = {
	value: string;
	label: string;
	/** Setting id of the API key shown first in the Provider section, when the provider has one. */
	credentialId?: string;
	/** Setting id of the base URL shown after the API key, when the provider has one. */
	baseUrlId?: string;
	bindings: ConfigBinding[];
};

const credentialNames = [
	["openaiApiKey", "OpenAI", "OPENAI_API_KEY"], ["braveApiKey", "Brave", "BRAVE_API_KEY"],
	["parallelApiKey", "Parallel", "PARALLEL_API_KEY"], ["tinyfishApiKey", "TinyFish", "TINYFISH_API_KEY"],
	["search1apiApiKey", "Search1API", "SEARCH1API_KEY"], ["searchinfinityApiKey", "Searchinfinity", "SEARCHINFINITY_API_KEY"],
	["queritApiKey", "Querit", "QUERIT_API_KEY"], ["tavilyApiKey", "Tavily", "TAVILY_API_KEY"],
	["serpdiveApiKey", "SERPdive", "SERPDIVE_API_KEY"], ["kagiApiKey", "Kagi", "KAGI_API_KEY"],
	["ollamaApiKey", "Ollama Cloud", "OLLAMA_API_KEY"], ["serpbaseApiKey", "SerpBase", "SERPBASE_API_KEY"],
	["anysearchApiKey", "AnySearch", "ANYSEARCH_API_KEY"], ["xaiApiKey", "xAI", "XAI_API_KEY"],
	["brightdataApiKey", "Bright Data", "BRIGHTDATA_API_KEY"], ["firecrawlApiKey", "Firecrawl", "FIRECRAWL_API_KEY"],
	["exaApiKey", "Exa", "EXA_API_KEY"], ["perplexityApiKey", "Perplexity", "PERPLEXITY_API_KEY"],
	["geminiApiKey", "Gemini", "GEMINI_API_KEY"], ["cloudflareApiKey", "Cloudflare AI Gateway", "CLOUDFLARE_API_KEY"],
] as const;

function credentialBinding(id: string, options?: { label?: string; description?: string }): ConfigBinding {
	const match = credentialNames.find(([credentialId]) => credentialId === id);
	if (!match) throw new Error(`Unknown credential binding: ${id}`);
	const [credentialId, providerLabel, environmentVariable] = match;
	return {
		setting: {
			id: credentialId,
			label: options?.label ?? "API Key",
			description: options?.description
				?? `${providerLabel} credential. Accepts a literal key, $${environmentVariable}, or a !command source. Shown as the currently configured value; clearing it removes the credential.`,
			type: "password",
			placeholder: `Literal key, $${environmentVariable}, or !command`,
		},
		path: [credentialId],
		defaultValue: "",
		sensitive: true,
	};
}

const cloudflareApiKeyBinding: ConfigBinding = credentialBinding("cloudflareApiKey", {
	label: "Cloudflare AI Gateway key",
	description: "Credential for the Cloudflare AI Gateway when a Gemini gateway base URL is configured. Accepts a literal key, $CLOUDFLARE_API_KEY, or a !command source.",
});

const summaryModelBinding: ConfigBinding = {
	setting: {
		id: "summaryModel",
		label: "Summary model",
		description: "Optional provider/model id. Empty uses the best enabled model.",
		type: "text",
		placeholder: "provider/model-id",
	},
	path: ["summaryModel"],
	defaultValue: "",
};

const geminiSearchModelBinding: ConfigBinding = {
	setting: {
		id: "searchModel",
		label: "Gemini search model",
		description: "Optional Gemini grounded-search model override.",
		type: "text",
		placeholder: "gemini-3.6-flash",
	},
	path: ["searchModel"],
	defaultValue: "",
};

function baseUrlBinding(id: string, providerLabel: string, description: string, placeholder: string): ConfigBinding {
	return {
		setting: {
			id,
			label: "Base URL",
			description,
			type: "text",
			placeholder,
		},
		path: [id],
		defaultValue: "",
	};
}

const openaiBaseUrlBinding = baseUrlBinding(
	"openaiResponsesUrl",
	"OpenAI",
	"Optional Responses-compatible endpoint override. Empty uses the default endpoint.",
	"https://api.openai.com/v1/responses",
);

const braveBaseUrlBinding = baseUrlBinding(
	"braveBaseUrl",
	"Brave",
	"Optional endpoint override. Empty uses the default endpoint.",
	"https://api.search.brave.com/res/v1/web/search",
);

const parallelBaseUrlBinding = baseUrlBinding(
	"parallelBaseUrl",
	"Parallel",
	"Optional gateway override; search and extract requests are routed there. Empty uses the default endpoint.",
	"https://api.parallel.ai",
);

const tinyfishBaseUrlBinding = baseUrlBinding(
	"tinyfishBaseUrl",
	"TinyFish",
	"Optional gateway override; search and fetch requests are routed there. Empty uses the default endpoints.",
	"https://api.search.tinyfish.ai",
);

const search1apiBaseUrlBinding = baseUrlBinding(
	"search1apiBaseUrl",
	"Search1API",
	"Optional gateway override; search and crawl requests are routed there. Empty uses the default endpoint.",
	"https://api.search1api.com",
);

const searchinfinityBaseUrlBinding = baseUrlBinding(
	"searchinfinityBaseUrl",
	"Searchinfinity",
	"Optional endpoint override. Empty uses the default endpoint.",
	"https://torchlight.byteintlapi.com/search_api/web_search",
);

const queritBaseUrlBinding = baseUrlBinding(
	"queritBaseUrl",
	"Querit",
	"Optional gateway override; search and contents requests are routed there. Empty uses the default endpoint.",
	"https://api.querit.ai",
);

const tavilyBaseUrlBinding = baseUrlBinding(
	"tavilyBaseUrl",
	"Tavily",
	"Optional endpoint override. Empty uses the default endpoint.",
	"https://api.tavily.com/search",
);

const serpdiveBaseUrlBinding = baseUrlBinding(
	"serpdiveBaseUrl",
	"SERPdive",
	"Optional endpoint override. Empty uses the default endpoint.",
	"https://api.serpdive.com/v1/search",
);

const kagiBaseUrlBinding = baseUrlBinding(
	"kagiBaseUrl",
	"Kagi",
	"Optional gateway override; search and extract requests are routed there. Empty uses the default endpoint.",
	"https://kagi.com",
);

const ollamaBaseUrlBinding = baseUrlBinding(
	"ollamaBaseUrl",
	"Ollama Cloud",
	"Optional gateway override; search and fetch requests are routed there. Empty uses the default endpoint.",
	"https://ollama.com",
);

const exaBaseUrlBinding = baseUrlBinding(
	"exaBaseUrl",
	"Exa",
	"Optional gateway override for the direct answer and search APIs; the zero-config Exa MCP tool is not affected. Empty uses the default endpoint.",
	"https://api.exa.ai",
);

const perplexityBaseUrlBinding = baseUrlBinding(
	"perplexityBaseUrl",
	"Perplexity",
	"Optional endpoint override. Empty uses the default endpoint.",
	"https://api.perplexity.ai/chat/completions",
);

const anysearchBaseUrlBinding = baseUrlBinding(
	"anysearchBaseUrl",
	"AnySearch",
	"Optional endpoint override. Empty uses the default endpoint.",
	"https://api.anysearch.com/v1/search",
);

const xaiBaseUrlBinding = baseUrlBinding(
	"xaiBaseUrl",
	"xAI",
	"Optional Responses-compatible endpoint override. Empty uses the default endpoint.",
	"https://api.x.ai/v1/responses",
);

const brightdataBaseUrlBinding = baseUrlBinding(
	"brightdataBaseUrl",
	"Bright Data",
	"Optional endpoint override. Empty uses the default endpoint.",
	"https://api.brightdata.com/request",
);

const serpbaseBaseUrlBinding = baseUrlBinding(
	"serpbaseBaseUrl",
	"SerpBase",
	"Optional endpoint override. Empty uses the default endpoint.",
	"https://api.serpbase.dev/google/search",
);

const geminiBaseUrlBinding = baseUrlBinding(
	"geminiBaseUrl",
	"Gemini",
	"Optional bare gateway URL without an API version suffix. Empty uses the default endpoint.",
	"https://generativelanguage.googleapis.com",
);

const searxngBaseUrlBinding = baseUrlBinding(
	"searxngBaseUrl",
	"SearXNG",
	"Self-hosted SearXNG search instance. Search is routed here first when configured.",
	"https://search.example.com",
);

const firecrawlBaseUrlBinding = baseUrlBinding(
	"firecrawlBaseUrl",
	"Firecrawl",
	"Optional firewall-compatible Firecrawl server for blocked-content extraction.",
	"https://api.firecrawl.dev",
);

const openaiSearchModelBinding: ConfigBinding = {
	setting: {
		id: "openaiSearchModel",
		label: "OpenAI search model",
		description: "Optional model id for OpenAI Responses web search.",
		type: "text",
		placeholder: "gpt-5.6-terra",
	},
	path: ["openaiSearchModel"],
	defaultValue: "",
};

const xaiSearchModelBinding: ConfigBinding = {
	setting: {
		id: "xaiSearchModel",
		label: "xAI search model",
		description: "Optional Grok model id for xAI hosted web search.",
		type: "text",
		placeholder: "grok-4.5",
	},
	path: ["xaiSearchModel"],
	defaultValue: "",
};

const serpdiveModelBinding: ConfigBinding = {
	setting: {
		id: "serpdiveModel",
		label: "SERPdive retrieval depth",
		description: "Krill is the free tier; Mako and Moby consume paid credits.",
		type: "select",
		options: [
			{ value: "krill", label: "Krill - free" },
			{ value: "mako", label: "Mako - focused" },
			{ value: "moby", label: "Moby - full content" },
		],
	},
	path: ["serpdiveModel"],
	defaultValue: "krill",
};

const githubCloneEnabledBinding: ConfigBinding = {
	setting: {
		id: "githubCloneEnabled",
		label: "GitHub repository cloning",
		description: "Allow repository-aware extraction for GitHub URLs.",
		type: "toggle",
	},
	path: ["githubClone", "enabled"],
	defaultValue: true,
};

const githubMaxRepoSizeMBBinding: ConfigBinding = {
	setting: {
		id: "githubMaxRepoSizeMB",
		label: "GitHub clone size limit",
		description: "Repositories above this size use a lightweight API view.",
		type: "number",
		min: 1,
	},
	path: ["githubClone", "maxRepoSizeMB"],
	defaultValue: 350,
};

const githubCloneTimeoutSecondsBinding: ConfigBinding = {
	setting: {
		id: "githubCloneTimeoutSeconds",
		label: "GitHub clone timeout",
		description: "Maximum seconds allowed for a repository clone.",
		type: "number",
		min: 1,
		max: 600,
	},
	path: ["githubClone", "cloneTimeoutSeconds"],
	defaultValue: 30,
};

const githubClonePathBinding: ConfigBinding = {
	setting: {
		id: "githubClonePath",
		label: "GitHub clone cache path",
		description: "Absolute runtime path for temporary repository clones.",
		type: "text",
		placeholder: "/tmp/pi-github-repos",
	},
	path: ["githubClone", "clonePath"],
	defaultValue: "/tmp/pi-github-repos",
};

const youtubeEnabledBinding: ConfigBinding = {
	setting: {
		id: "youtubeEnabled",
		label: "YouTube understanding",
		description: "Extract transcripts and analyze videos when available.",
		type: "toggle",
	},
	path: ["youtube", "enabled"],
	defaultValue: true,
};

const youtubePreferredModelBinding: ConfigBinding = {
	setting: {
		id: "youtubePreferredModel",
		label: "YouTube model",
		description: "Preferred Gemini model for transcript and video understanding.",
		type: "text",
		placeholder: "gemini-3.6-flash",
	},
	path: ["youtube", "preferredModel"],
	defaultValue: "gemini-3.6-flash",
};

const videoEnabledBinding: ConfigBinding = {
	setting: {
		id: "videoEnabled",
		label: "Local video analysis",
		description: "Allow supported local video files to be analyzed.",
		type: "toggle",
	},
	path: ["video", "enabled"],
	defaultValue: true,
};

const videoPreferredModelBinding: ConfigBinding = {
	setting: {
		id: "videoPreferredModel",
		label: "Local video model",
		description: "Preferred Gemini model for local video analysis.",
		type: "text",
		placeholder: "gemini-3.6-flash",
	},
	path: ["video", "preferredModel"],
	defaultValue: "gemini-3.6-flash",
};

const videoMaxSizeMBBinding: ConfigBinding = {
	setting: {
		id: "videoMaxSizeMB",
		label: "Local video size limit",
		description: "Maximum local video upload size in MB.",
		type: "number",
		min: 1,
	},
	path: ["video", "maxSizeMB"],
	defaultValue: 50,
};

const pdfMaxSizeMBBinding: ConfigBinding = {
	setting: {
		id: "pdfMaxSizeMB",
		label: "PDF size limit",
		description: "Maximum PDF download size in MB.",
		type: "number",
		min: 1,
		max: 50,
	},
	path: ["pdf", "maxSizeMB"],
	defaultValue: 20,
};

const firecrawlFreshScrapeBinding: ConfigBinding = {
	setting: {
		id: "firecrawlFreshScrape",
		label: "Allow fresh Firecrawl requests",
		description: "Permit the configured Firecrawl server to fetch targets not already cached.",
		type: "toggle",
	},
	path: ["firecrawlFreshScrape"],
	defaultValue: false,
};

const allowBrowserCookiesBinding: ConfigBinding = {
	setting: {
		id: "allowBrowserCookies",
		label: "Gemini browser cookies",
		description: "Allow read-only Chromium cookie discovery for Gemini Web.",
		type: "toggle",
	},
	path: ["allowBrowserCookies"],
	defaultValue: false,
};

const chromeProfileBinding: ConfigBinding = {
	setting: {
		id: "chromeProfile",
		label: "Chromium profile",
		description: "Optional profile name used for Gemini Web cookie discovery.",
		type: "text",
		placeholder: "Profile 2",
	},
	path: ["chromeProfile"],
	defaultValue: "",
};

const trustEnvProxyBinding: ConfigBinding = {
	setting: {
		id: "trustEnvProxy",
		label: "Trust configured environment proxy",
		description: "Skip hostname DNS preflight only when an HTTP(S) proxy applies.",
		type: "toggle",
	},
	path: ["ssrf", "trustEnvProxy"],
	defaultValue: false,
};

const ssrfAllowRangesBinding: ConfigBinding = {
	setting: {
		id: "ssrfAllowRanges",
		label: "Allowed proxy ranges",
		description: "Comma-separated CIDRs for narrow fake-IP or private proxy ranges.",
		type: "text",
		placeholder: "198.18.0.0/15, fd00::/8",
	},
	path: ["ssrf", "allowRanges"],
	defaultValue: "",
	fromConfig: (value) => Array.isArray(value) ? value.join(", ") : "",
	toConfig: (value) => String(value).split(",").map((part) => part.trim()).filter(Boolean),
};

const fetchDomainAllowBinding: ConfigBinding = {
	setting: {
		id: "fetchDomainAllow",
		label: "Allowed fetch domains",
		description: "Optional comma-separated allowlist for fetch_content.",
		type: "text",
		placeholder: "docs.example.com, github.com",
	},
	path: ["fetchContent", "domainPolicy", "allow"],
	defaultValue: "",
	fromConfig: commaSeparated,
	toConfig: (value) => String(value).split(",").map((part) => part.trim()).filter(Boolean),
};

const fetchDomainDenyBinding: ConfigBinding = {
	setting: {
		id: "fetchDomainDeny",
		label: "Blocked fetch domains",
		description: "Optional comma-separated denylist; deny rules take precedence.",
		type: "text",
		placeholder: "internal.example.com",
	},
	path: ["fetchContent", "domainPolicy", "deny"],
	defaultValue: "",
	fromConfig: commaSeparated,
	toConfig: (value) => String(value).split(",").map((part) => part.trim()).filter(Boolean),
};

const firecrawlApiVersionBinding: ConfigBinding = {
	setting: {
		id: "firecrawlApiVersion",
		label: "Firecrawl API version",
		description: "Use v1 only for older self-hosted deployments.",
		type: "select",
		options: [{ value: "v2", label: "v2" }, { value: "v1", label: "v1" }],
	},
	path: ["firecrawlApiVersion"],
	defaultValue: "v2",
};

const brightdataSerpZoneBinding: ConfigBinding = {
	setting: {
		id: "brightdataSerpZone",
		label: "Bright Data SERP zone",
		description: "Required zone of Bright Data type serp for paid SERP search.",
		type: "text",
		placeholder: "pi_serp",
	},
	path: ["brightdataSerpZone"],
	defaultValue: "",
};

const brightdataUnlockerZoneBinding: ConfigBinding = {
	setting: {
		id: "brightdataUnlockerZone",
		label: "Bright Data Unlocker zone",
		description: "Required zone of Bright Data type unblocker for the paid fetch fallback.",
		type: "text",
		placeholder: "pi_unlocker",
	},
	path: ["brightdataUnlockerZone"],
	defaultValue: "",
};

const providerSections: ProviderSectionDefinition[] = [
	{
		value: "openai", label: "OpenAI", credentialId: "openaiApiKey", baseUrlId: "openaiResponsesUrl",
		bindings: [
			credentialBinding("openaiApiKey"), openaiBaseUrlBinding, openaiSearchModelBinding,
		],
	},
	{
		value: "brave", label: "Brave", credentialId: "braveApiKey", baseUrlId: "braveBaseUrl",
		bindings: [credentialBinding("braveApiKey"), braveBaseUrlBinding],
	},
	{
		value: "parallel", label: "Parallel", credentialId: "parallelApiKey", baseUrlId: "parallelBaseUrl",
		bindings: [credentialBinding("parallelApiKey"), parallelBaseUrlBinding],
	},
	{
		value: "tinyfish", label: "TinyFish", credentialId: "tinyfishApiKey", baseUrlId: "tinyfishBaseUrl",
		bindings: [credentialBinding("tinyfishApiKey"), tinyfishBaseUrlBinding],
	},
	{
		value: "search1api", label: "Search1API", credentialId: "search1apiApiKey", baseUrlId: "search1apiBaseUrl",
		bindings: [credentialBinding("search1apiApiKey"), search1apiBaseUrlBinding],
	},
	{
		value: "searchinfinity", label: "Searchinfinity", credentialId: "searchinfinityApiKey", baseUrlId: "searchinfinityBaseUrl",
		bindings: [credentialBinding("searchinfinityApiKey"), searchinfinityBaseUrlBinding],
	},
	{
		value: "querit", label: "Querit", credentialId: "queritApiKey", baseUrlId: "queritBaseUrl",
		bindings: [credentialBinding("queritApiKey"), queritBaseUrlBinding],
	},
	{
		value: "tavily", label: "Tavily", credentialId: "tavilyApiKey", baseUrlId: "tavilyBaseUrl",
		bindings: [credentialBinding("tavilyApiKey"), tavilyBaseUrlBinding],
	},
	{
		value: "serpdive", label: "SERPdive", credentialId: "serpdiveApiKey", baseUrlId: "serpdiveBaseUrl",
		bindings: [credentialBinding("serpdiveApiKey"), serpdiveBaseUrlBinding, serpdiveModelBinding],
	},
	{
		value: "kagi", label: "Kagi", credentialId: "kagiApiKey", baseUrlId: "kagiBaseUrl",
		bindings: [credentialBinding("kagiApiKey"), kagiBaseUrlBinding],
	},
	{
		value: "ollama", label: "Ollama Cloud", credentialId: "ollamaApiKey", baseUrlId: "ollamaBaseUrl",
		bindings: [credentialBinding("ollamaApiKey"), ollamaBaseUrlBinding],
	},
	{
		value: "searxng", label: "SearXNG", baseUrlId: "searxngBaseUrl",
		bindings: [searxngBaseUrlBinding],
	},
	{
		value: "exa", label: "Exa", credentialId: "exaApiKey", baseUrlId: "exaBaseUrl",
		bindings: [credentialBinding("exaApiKey"), exaBaseUrlBinding],
	},
	{
		value: "perplexity", label: "Perplexity", credentialId: "perplexityApiKey", baseUrlId: "perplexityBaseUrl",
		bindings: [credentialBinding("perplexityApiKey"), perplexityBaseUrlBinding],
	},
	{
		value: "gemini", label: "Gemini", credentialId: "geminiApiKey", baseUrlId: "geminiBaseUrl",
		bindings: [
			credentialBinding("geminiApiKey"), geminiBaseUrlBinding, cloudflareApiKeyBinding,
			geminiSearchModelBinding, allowBrowserCookiesBinding, chromeProfileBinding,
		],
	},
	{
		value: "anysearch", label: "AnySearch", credentialId: "anysearchApiKey", baseUrlId: "anysearchBaseUrl",
		bindings: [credentialBinding("anysearchApiKey"), anysearchBaseUrlBinding],
	},
	{
		value: "xai", label: "xAI", credentialId: "xaiApiKey", baseUrlId: "xaiBaseUrl",
		bindings: [credentialBinding("xaiApiKey"), xaiBaseUrlBinding, xaiSearchModelBinding],
	},
	{
		value: "brightdata", label: "Bright Data", credentialId: "brightdataApiKey", baseUrlId: "brightdataBaseUrl",
		bindings: [
			credentialBinding("brightdataApiKey"), brightdataBaseUrlBinding,
			brightdataSerpZoneBinding, brightdataUnlockerZoneBinding,
		],
	},
	{
		value: "serpbase", label: "SerpBase", credentialId: "serpbaseApiKey", baseUrlId: "serpbaseBaseUrl",
		bindings: [credentialBinding("serpbaseApiKey"), serpbaseBaseUrlBinding],
	},
	{
		value: "firecrawl", label: "Firecrawl", credentialId: "firecrawlApiKey", baseUrlId: "firecrawlBaseUrl",
		bindings: [
			credentialBinding("firecrawlApiKey"), firecrawlBaseUrlBinding, firecrawlApiVersionBinding,
			firecrawlFreshScrapeBinding,
		],
	},
];

const githubBindings: ConfigBinding[] = [
	githubCloneEnabledBinding,
	githubMaxRepoSizeMBBinding,
	githubCloneTimeoutSecondsBinding,
	githubClonePathBinding,
];

const youtubeBindings: ConfigBinding[] = [
	youtubeEnabledBinding,
	youtubePreferredModelBinding,
	videoEnabledBinding,
	videoPreferredModelBinding,
	videoMaxSizeMBBinding,
];

const pdfBindings: ConfigBinding[] = [
	pdfMaxSizeMBBinding,
];

const privacyBindings: ConfigBinding[] = [
	trustEnvProxyBinding,
	ssrfAllowRangesBinding,
	fetchDomainAllowBinding,
	fetchDomainDenyBinding,
];

/** Everything on the Provider page that is not provider-specific lands in Advanced. */
const advancedBindings: ConfigBinding[] = [
	...advancedCoreBindings,
	summaryModelBinding,
];

function providerSection(provider: string): AetherSettingsSection & { bindings: ConfigBinding[] } {
	const section = providerSections.find((item) => item.value === provider);
	const bindings: ConfigBinding[] = [providerBinding];
	if (section) {
		const credential = section.credentialId
			? section.bindings.find((binding) => binding.setting.id === section.credentialId)
			: undefined;
		const baseUrl = section.baseUrlId
			? section.bindings.find((binding) => binding.setting.id === section.baseUrlId)
			: undefined;
		bindings.push(
			...(credential ? [credential] : []),
			...(baseUrl ? [baseUrl] : []),
			...section.bindings.filter((binding) => binding !== credential && binding !== baseUrl),
		);
	}
	return {
		id: "provider",
		title: "Provider",
		description: section
			? `Default provider and ${section.label} configuration. Credentials are persisted in the existing Pi config file.`
			: "Pick a specific provider above to configure its API key, base URL, and provider-specific options.",
		settings: bindings.map((item) => item.setting),
		bindings,
	};
}

const toolsSection: AetherSettingsSection = {
	id: "tools",
	title: "Web search tools",
	description: "Register search and source-check tools after the next extension reload.",
	settings: [webSearchEnabledBinding.setting],
};

/** Fallback layout for Aether builds that do not render page-level sections yet. */
const generalCategory: AetherSettingsCategory = {
	id: "general",
	title: "Web search tools",
	subtitle: "Master switch for web search and source verification",
	icon: "auto",
	order: 0,
	sections: [toolsSection],
};

const extractionCategory: AetherSettingsCategory = {
	id: "extraction",
	title: "Context Extraction",
	subtitle: "GitHub, video, and PDF handling",
	icon: "code",
	order: 2,
	sections: [
		{
			id: "github",
			title: "GitHub",
			description: "Repository cloning, cache path, and size limits",
			settings: githubBindings.map((item) => item.setting),
		},
		{
			id: "youtube",
			title: "YouTube",
			description: "Transcript and video understanding for YouTube and local files",
			settings: youtubeBindings.map((item) => item.setting),
		},
		{
			id: "pdf",
			title: "PDF",
			description: "PDF download limits",
			settings: pdfBindings.map((item) => item.setting),
		},
	],
};

const privacyCategory: AetherSettingsCategory = {
	id: "privacy",
	title: "Privacy and network",
	subtitle: "Browser data access, SSRF exceptions, and fetch domain policy",
	icon: "info",
	order: 3,
	sections: [{
		id: "privacy",
		title: "Privacy and network",
		description: "SSRF exceptions and fetch domain policy",
		settings: privacyBindings.map((item) => item.setting),
	}],
};

function categoriesForProvider(provider: string): AetherSettingsCategory[] {
	return [
		{
			id: "provider",
			title: "Provider",
			subtitle: "Default search provider, credentials, and base URLs",
			icon: "auto",
			order: 1,
			sections: [
				providerSection(provider),
				{
					id: "advanced",
					title: "Advanced",
					description: "Routing, review workflow, and summary model",
					settings: advancedBindings.map((item) => item.setting),
				},
			],
		},
		extractionCategory,
		privacyCategory,
	];
}

const allBindings = Array.from(
	new Map([
		webSearchEnabledBinding,
		providerBinding,
		...advancedBindings,
		...githubBindings,
		...youtubeBindings,
		...pdfBindings,
		...privacyBindings,
		...providerSections.flatMap((section) => section.bindings),
	].map((binding) => [binding.setting.id, binding])).values(),
);

function readConfig(): Record<string, unknown> {
	const path = getWebSearchConfigPath();
	if (!existsSync(path)) return {};
	const value = JSON.parse(readFileSync(path, "utf8"));
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`Invalid config in ${path}: expected a JSON object`);
	}
	return value;
}

function writeConfig(config: Record<string, unknown>): void {
	const path = getWebSearchConfigPath();
	mkdirSync(dirname(path), { recursive: true });
	const temporaryPath = `${path}.${process.pid}.aether.tmp`;
	writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
	renameSync(temporaryPath, path);
}

function getAtPath(root: Record<string, unknown>, path: string[]): unknown {
	let value: unknown = root;
	for (const segment of path) {
		if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
		value = (value as Record<string, unknown>)[segment];
	}
	return value;
}

function setAtPath(root: Record<string, unknown>, path: string[], value: unknown): void {
	let target = root;
	for (const segment of path.slice(0, -1)) {
		const current = target[segment];
		if (!current || typeof current !== "object" || Array.isArray(current)) target[segment] = {};
		target = target[segment] as Record<string, unknown>;
	}
	const key = path.at(-1)!;
	if (value === "" || (Array.isArray(value) && value.length === 0)) delete target[key];
	else target[key] = value;
}

function normalizeSettingValue(binding: ConfigBinding, raw: unknown): SettingValue {
	const setting = binding.setting;
	if (setting.type === "toggle") return raw === true || raw === "true";
	if (setting.type === "number" || setting.type === "slider") {
		const fallback = Number(binding.defaultValue);
		const parsed = typeof raw === "number" ? raw : Number(raw);
		return Math.min(setting.max ?? parsed, Math.max(setting.min ?? parsed, Number.isFinite(parsed) ? parsed : fallback));
	}
	if (setting.type === "select") {
		const candidate = String(raw ?? "");
		return setting.options?.some((option) => option.value === candidate) ? candidate : binding.defaultValue;
	}
	return String(raw ?? "").trim();
}

function initialProvider(config: Record<string, unknown>, storage: AetherJsonObject): string {
	const stored = storage.provider;
	if (typeof stored === "string" && providerSections.some((section) => section.value === stored)) return stored;
	const configured = typeof config.provider === "string"
		? config.provider
		: typeof config.searchProvider === "string"
			? config.searchProvider
			: "";
	if (providerSections.some((section) => section.value === configured)) return configured;
	return "auto";
}

function messageText(message: AetherJsonObject): string {
	const direct = typeof message.text === "string" ? message.text : typeof message.content === "string" ? message.content : "";
	if (direct) return direct;
	if (!Array.isArray(message.content)) return "";
	return message.content.map((part) => {
		if (!part || typeof part !== "object") return "";
		return typeof (part as AetherJsonObject).text === "string" ? (part as AetherJsonObject).text : "";
	}).join("\n");
}

function statusCard(api: AetherExtensionAPI, title: string, message: AetherJsonObject, tone = "neutral") {
	const text = messageText(message);
	const details = message.details && typeof message.details === "object" ? message.details as AetherJsonObject : message;
	const chips = [
		typeof details.provider === "string" ? details.provider : "",
		typeof details.sourceCount === "number" ? `${details.sourceCount} sources` : "",
		typeof details.totalResults === "number" ? `${details.totalResults} results` : "",
		typeof details.successfulQueries === "number" && typeof details.queryCount === "number" ? `${details.successfulQueries}/${details.queryCount} queries` : "",
		typeof details.successful === "number" && typeof details.total === "number" ? `${details.successful}/${details.total}` : "",
	].filter(Boolean);
	return api.ui.card([
		api.ui.row([
			api.ui.text(title, { style: "label", weight: 1, color: tone === "error" ? "error" : "accent" }),
			...chips.map((chip) => api.ui.text(String(chip), { style: "label", color: "muted" })),
		], { arrangement: "space-between", verticalAlignment: "center", wrap: true, rowSpacing: 6 }),
		...(text ? [api.ui.text(text, { color: tone === "error" ? "error" : "default", maxLines: 12 })] : []),
	], { tone, radius: 8, spacing: 8, contentPadding: 14 });
}

function messageTypes(api: AetherExtensionAPI): AetherMessageTypeDefinition[] {
	return [
		{ type: "web-search-results", title: "Web research", icon: "auto", render: ({ message }) => statusCard(api, "Web research", message) },
		{ type: "web-search-content-ready", title: "Web content ready", icon: "refresh", render: ({ message }) => statusCard(api, "Web content ready", message) },
		{ type: "web-search-error", title: "Web access error", icon: "warning", render: ({ message }) => statusCard(api, "Web access error", message, "error") },
		{ type: "curator-config", title: "Search workflow", icon: "settings", render: ({ message }) => statusCard(api, "Search workflow updated", message) },
		{ type: "google-account", title: "Gemini Web account", icon: "info", render: ({ message }) => statusCard(api, "Gemini Web account", message) },
	];
}

export async function appendAetherWebMessage(
	type: string,
	payload: AetherJsonObject,
	text = "",
): Promise<boolean> {
	const bridge = (globalThis as Record<PropertyKey, unknown>)[BRIDGE_KEY] as WebAccessBridge | undefined;
	if (!bridge) return false;
	try {
		const latest = { type, payload, text, at: Date.now() };
		bridge.api.storage.set("latestActivity", latest);
		await bridge.api.messages.append(type, payload, text);
		return true;
	} catch {
		return false;
	}
}

const webToolTitles = [
	["web_search", "Searching the web", "Searched the web"],
	["source_check", "Checking sources", "Checked sources"],
	["fetch_content", "Fetching web content", "Fetched web content"],
	["get_search_content", "Reading web content", "Read web content"],
] as const;

export const activateAether = async (aether: AetherExtensionAPI) => {
	(globalThis as Record<PropertyKey, unknown>)[BRIDGE_KEY] = { api: aether } satisfies WebAccessBridge;
	for (const [toolName, runningTitle, completedTitle] of webToolTitles) {
		aether.registerToolTitle?.(toolName, runningTitle, completedTitle, 200);
	}
	let config: Record<string, unknown> = {};
	try {
		config = readConfig();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		aether.host.invoke("app.notify", { message: `Web Access settings could not read the Pi config: ${message}` }).catch(() => {});
	}
	const storage = aether.storage.snapshot();
	const settingStorageKey = (settingId: string) => `settings:${SETTINGS_PAGE_ID}:${settingId}`;
	for (const binding of allBindings) {
		if (binding.sensitive) {
			// Credentials are shown back in the form (masked), so always reflect
			// the currently configured value instead of a one-time seed.
			const configured = getAtPath(config, binding.path);
			const current = configured === undefined || configured === null ? "" : String(configured);
			aether.storage.set(binding.setting.id, current);
			aether.storage.set(settingStorageKey(binding.setting.id), current);
			continue;
		}
		if (Object.prototype.hasOwnProperty.call(storage, binding.setting.id)) continue;
		const configured = binding.setting.id === "provider"
			? config.provider ?? config.searchProvider
			: getAtPath(config, binding.path);
		const initial = configured === undefined
			? binding.defaultValue
			: binding.fromConfig?.(configured) ?? normalizeSettingValue(binding, configured);
		aether.storage.set(binding.setting.id, initial);
	}

	const registerSettingsPage = (providerValue: string) => {
		const definition = {
			id: SETTINGS_PAGE_ID,
			title: "Web Access",
			subtitle: "Search, source verification, extraction, and provider routing",
			icon: "auto",
			order: 20,
			sections: [toolsSection],
			categories: categoriesForProvider(providerValue),
		};
		try {
			aether.registerSettings(definition);
		} catch {
			// Older Aether builds only accept sections OR categories. Fall back
			// to the master toggle as its own top-level category.
			aether.registerSettings({
				...definition,
				sections: undefined,
				categories: [generalCategory, ...categoriesForProvider(providerValue)],
			});
		}
	};

	const registerBindingActions = () => {
		for (const binding of allBindings) {
			aether.registerAction(`settings:${SETTINGS_PAGE_ID}:${binding.setting.id}`, async (payload) => {
				const raw = payload.value !== undefined ? payload.value : payload.checked;
				const value = normalizeSettingValue(binding, raw);
				const next = readConfig();
				if (binding.apply) binding.apply(next, value);
				else setAtPath(next, binding.path, binding.toConfig?.(value) ?? value);
				writeConfig(next);
				if (binding.sensitive) {
					aether.storage.set(binding.setting.id, value);
					aether.storage.set(settingStorageKey(binding.setting.id), value);
					await aether.host.invoke("app.notify", { message: "Credential or base URL updated. Reload the Pi extension to apply it." }).catch(() => {});
					return { setting: binding.setting.id, value };
				}
				aether.storage.set(binding.setting.id, value);
				aether.storage.set(settingStorageKey(binding.setting.id), value);
				if (binding.setting.id === "provider") {
					registerSettingsPage(String(value));
				}
				if (binding.setting.id === "searchRoutingProviders" && value !== "") {
					aether.storage.set("provider", "auto");
					aether.storage.set(settingStorageKey("provider"), "auto");
					registerSettingsPage("auto");
				}
				await aether.host.invoke("app.notify", { message: "Web Access setting saved. Reload the Pi extension to apply it." }).catch(() => {});
				return { setting: binding.setting.id, value };
			});
		}
	};

	registerBindingActions();
	registerSettingsPage(initialProvider(config, storage));

	for (const definition of messageTypes(aether)) aether.registerMessageType(definition);

	aether.registerAction("dismiss-latest-activity", () => aether.storage.delete("latestActivity"));
	aether.registerAction("research-draft", async () => {
		await aether.host.invoke("app.appendDraftInput", { text: "Research this on the web with multiple independent sources: " });
	});
	aether.registerComposerMenuItem({
		id: "research-web",
		title: "Research on the web",
		subtitle: "Draft a multi-source research request",
		icon: "auto",
		order: 30,
		action: "research-draft",
	});
	aether.registerSurface("chat.list.end", {
		id: "latest-web-activity",
		order: 90,
		render: (context) => {
			const currentStorage = context.storage;
			if (Array.isArray(context.custom_messages)) return null;
			const latest = currentStorage.latestActivity;
			if (!latest || typeof latest !== "object" || Array.isArray(latest)) return null;
			const activity = latest as AetherJsonObject;
			const payload = activity.payload && typeof activity.payload === "object" ? activity.payload as AetherJsonObject : {};
			const type = String(activity.type ?? "");
			const title = type === "web-search-error" ? "Web access error" : type === "web-search-content-ready" ? "Web content ready" : "Latest web activity";
			return aether.ui.column([
				statusCard(aether, title, { ...payload, text: activity.text }, type === "web-search-error" ? "error" : "neutral"),
				aether.ui.button("Dismiss", "dismiss-latest-activity", { tone: "neutral", icon: "close" }),
			], { spacing: 6 });
		},
	});

	return () => {
		const bridge = (globalThis as Record<PropertyKey, unknown>)[BRIDGE_KEY] as WebAccessBridge | undefined;
		if (bridge?.api === aether) delete (globalThis as Record<PropertyKey, unknown>)[BRIDGE_KEY];
	};
};
