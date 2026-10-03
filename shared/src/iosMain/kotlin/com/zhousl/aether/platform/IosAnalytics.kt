package com.zhousl.aether.platform

interface IosAnalyticsListener {
    fun onConsentAccepted()
    fun onCapture(event: String, properties: Map<String, Any>)
}

// All callers, including native settings commands, run on the main thread.
open class IosAnalyticsBridge {
    private var listener: IosAnalyticsListener? = null
    private var consentAccepted = false

    fun setListener(listener: IosAnalyticsListener?) {
        this.listener = listener
        if (consentAccepted) listener?.onConsentAccepted()
    }

    fun acceptConsent() {
        if (consentAccepted) return
        consentAccepted = true
        listener?.onConsentAccepted()
    }

    fun capture(event: String, properties: Map<String, Any> = emptyMap()) {
        if (!consentAccepted) return
        runCatching { listener?.onCapture(event, properties) }
    }
}

object IosAnalytics : IosAnalyticsBridge()
