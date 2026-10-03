package com.zhousl.aether.ui

import kotlin.test.Test
import kotlin.test.assertEquals

class BashHighlightingTest {
    @Test
    fun bashHighlightingPreservesLongQuotedCommands() {
        val command = "sh -c \"" + "echo test; ".repeat(30_000) + "\""
        assertEquals("$ $command", highlightSharedBashCommand(command).text)
    }
}
