package com.zhousl.aether.ui

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class MarkdownMathTest {
    @Test
    fun completeDisplayMathPreservesBlankLinesAndMarkdownMarkers() {
        for ((open, close) in listOf("\\[" to "\\]", "$$" to "$$")) {
            val lines = listOf("Before", open, "a", "=", "", "- b", close, "After")
            assertEquals(6, markdownDisplayMathBlockEnd(lines, 1) { it })
        }
    }

    @Test
    fun malformedDelimitersAreNotRepaired() {
        val invalid = listOf(
            listOf("[", "a=b", "]"),
            listOf("\\\\[", "a=b", "\\\\]"),
            listOf("\\[", "a=b"),
            listOf("\\[", "a=b", "$$"),
            listOf("$$", "a=b", "\\]"),
            listOf("\\[", "", "\\]"),
        )
        invalid.forEach { lines -> assertNull(markdownDisplayMathBlockEnd(lines, 0) { it }) }
    }
}
