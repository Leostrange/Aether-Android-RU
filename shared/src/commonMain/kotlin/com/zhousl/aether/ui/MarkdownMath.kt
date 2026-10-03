package com.zhousl.aether.ui

// JSON is embedded directly in JavaScript. Raw Kotlin strings preserve its escaping.
const val MarkdownMathDelimitersJson = """[
    {"left":"$$","right":"$$","display":true},
    {"left":"\\[","right":"\\]","display":true},
    {"left":"$","right":"$","display":false},
    {"left":"\\(","right":"\\)","display":false}
]"""

// Protect complete display blocks before Markdown interprets their lines as headings or lists.
fun <T> markdownDisplayMathBlockEnd(
    lines: List<T>,
    startIndex: Int,
    lineText: (T) -> String,
): Int? {
    val opening = lines.getOrNull(startIndex)?.let(lineText)?.trim()
    val closing = when (opening) {
        "\\[" -> "\\]"
        "$$" -> "$$"
        else -> return null
    }
    var hasContent = false
    for (index in startIndex + 1 until lines.size) {
        val text = lineText(lines[index]).trim()
        if (text == closing) return index.takeIf { hasContent }
        if (text.isNotBlank()) hasContent = true
    }
    return null
}
