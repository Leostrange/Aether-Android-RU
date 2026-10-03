package com.zhousl.aether.ui

import kotlin.test.Test
import kotlin.test.assertEquals

class BashCommandTokensTest {
    @Test
    fun preservesVariableAndOptionBoundaries() {
        assertEquals(
            listOf("echo", " ", "\$HOME", "/file", " ", "--output", "=file", " ", "-n", " ", "\$_name2"),
            bashCommandTokens("echo \$HOME/file --output=file -n \$_name2").toList(),
        )
    }

    @Test
    fun preservesShellTokens() {
        assertEquals(
            listOf("echo", " ", "\"hello world\"", " ", "&&", " ", "cat", " ", "./file", "|", "wc", " ", "-l", ";", "\n", "echo", " ", "\$HOME"),
            bashCommandTokens("echo \"hello world\" && cat ./file|wc -l;\necho \$HOME").toList(),
        )
    }

    @Test
    fun preservesEscapedQuotesAndEmptyQuotes() {
        val command = "echo \"a\\\"b\" '' 'a\\'b'"
        assertEquals(listOf("echo", " ", "\"a\\\"b\"", " ", "''", " ", "'a\\'b'"), bashCommandTokens(command).toList())
    }

    @Test
    fun longQuotedScriptsAreStackSafeAndLossless() {
        for (quote in listOf("\"", "'")) {
            val script = "x\\\\y\n".repeat(50_000)
            val token = quote + script + quote
            assertEquals(listOf("sh", " ", "-c", " ", token), bashCommandTokens("sh -c $token").toList())
            val unfinished = "sh -c $quote$script\\"
            assertEquals(unfinished, bashCommandTokens(unfinished).joinToString(""))
        }
    }

    @Test
    fun emptyAndUnusualInputIsLossless() {
        for (command in listOf("", "\t\n", "a&b || (echo 123)>/tmp/out", "echo \"unterminated", "echo \uD83D\uDE00\u4F60\u597D")) {
            assertEquals(command, bashCommandTokens(command).joinToString(""))
        }
    }
}
