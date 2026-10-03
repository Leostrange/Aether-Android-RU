import Foundation
import AetherShared
import PostHog

final class AetherAnalytics: NSObject, IosAnalyticsListener {
    static let shared = AetherAnalytics()
    private var initialized = false

    func onConsentAccepted() {
        guard !initialized,
              let url = Bundle.main.url(forResource: "PostHogConfig", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let settings = try? JSONDecoder().decode(Settings.self, from: data),
              !settings.apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { return }
        let config = PostHogConfig(projectToken: settings.apiKey, host: settings.host)
        config.captureApplicationLifecycleEvents = true
        config.captureScreenViews = true
        config.sessionReplay = false
        config.captureElementInteractions = false
        config.errorTrackingConfig.autoCapture = true
        config.errorTrackingConfig.inAppIncludes += ["Aether", "AetherShared", "com.baimoqilin.aether"]
        #if DEBUG
        config.debug = true
        #endif
        PostHogSDK.shared.setup(config)
        initialized = true
    }

    func onCapture(event: String, properties: [String: Any]) {
        guard initialized else { return }
        PostHogSDK.shared.capture(event, properties: properties)
    }

    private struct Settings: Decodable {
        let apiKey: String
        let host: String
    }
}
