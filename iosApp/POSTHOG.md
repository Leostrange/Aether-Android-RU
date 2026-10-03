# PostHog

iOS uses the same `posthog.apiKey` and `posthog.host` entries in the root
`local.properties` as Android. Both platforms give `POSTHOG_API_KEY` and
`POSTHOG_HOST` environment variables precedence over local properties for CI.
Values are trimmed; an empty host uses US ingestion. Missing project tokens disable the SDK.
The Gradle build generates a JSON resource; no project token is checked in.
Only the public project token is bundled, never the personal CLI API key.

Initialization waits for the persisted privacy-policy acceptance (or the user's
first acceptance). Earlier events are dropped, not buffered. Lifecycle events,
native screen views and fatal crash capture are enabled. Session replay and
element interaction capture are disabled. Business events contain metadata,
not prompts, responses, provider credentials, tool arguments or tool output.

Chat, onboarding, providers and skill operations use the same event names as
Android through `IosAnalytics`. Native settings commands use these same handlers.
iOS always uses the app-owned Alpine runtime, so Android-only Termux setup and
agent authorization/toggle events do not apply.

Fatal crashes are sent on the next consented launch. A debugger disables the
SDK's crash handler. The project's remote error-tracking configuration must also
enable exception autocapture; a disabled remote setting overrides the SDK setting
on both platforms. Retain archive dSYMs and upload them with the PostHog CLI
for symbolicated production crash reports. App Store Connect privacy answers
must also reflect analytics identifiers, product interaction and crash data.
