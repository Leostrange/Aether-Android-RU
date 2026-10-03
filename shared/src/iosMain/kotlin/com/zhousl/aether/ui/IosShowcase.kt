package com.zhousl.aether.ui

import platform.Foundation.NSFileManager
import platform.Foundation.NSHomeDirectory

/** Opt-in marker is installed only in devices used for filming, never in the app bundle. */
internal fun isIosShowcaseEnabled(): Boolean = NSFileManager.defaultManager.fileExistsAtPath(
    NSHomeDirectory() + "/Documents/aether-showcase-enabled",
)
