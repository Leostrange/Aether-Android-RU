package com.zhousl.aether

import androidx.compose.ui.window.ComposeUIViewController
import androidx.compose.ui.uikit.OnFocusBehavior
import com.zhousl.aether.platform.currentPlatformCapabilities
import com.zhousl.aether.runtime.IosAlpineRuntime
import com.zhousl.aether.runtime.NativeRuntimeHost
import com.zhousl.aether.ui.IosComposeApp
import com.zhousl.aether.data.createIosAetherSettingsStore
import com.zhousl.aether.data.createIosAetherChatHistoryDatabase
import com.zhousl.aether.platform.IosPlatformServices
import com.zhousl.aether.platform.IosNativeSettingsHost

fun MainViewController(runtimeHost: NativeRuntimeHost): platform.UIKit.UIViewController {
    val runtime = IosAlpineRuntime(runtimeHost)
    val settingsStore = createIosAetherSettingsStore()
    val chatHistoryDatabase = createIosAetherChatHistoryDatabase()
    val platformServices = IosPlatformServices(runtimeHost)
    return ComposeUIViewController(configure = {
        // Chat handles IME insets locally; never pan the entire iPad split layout.
        onFocusBehavior = OnFocusBehavior.DoNothing
    }) {
        IosComposeApp(
            runtime = runtime,
            capabilities = currentPlatformCapabilities,
            settingsStore = settingsStore,
            chatHistoryDatabase = chatHistoryDatabase,
            platformServices = platformServices,
            nativeSettingsHost = IosNativeSettingsHost,
        )
    }
}
