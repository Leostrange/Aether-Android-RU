package com.zhousl.aether.ui

/** Display-only shell tokens. Iterative scanning keeps long quoted scripts stack-safe. */
fun bashCommandTokens(command: String): Sequence<String> = sequence {
    var index = 0
    while (index < command.length) {
        val start = index
        val first = command[index++]
        when {
            first.isWhitespace() -> {
                while (index < command.length && command[index].isWhitespace()) index++
            }
            first == '"' || first == '\'' -> {
                while (index < command.length) {
                    val next = command[index++]
                    if (next == '\\' && index < command.length) index++
                    else if (next == first) break
                }
            }
            first == '|' || first == '&' && command.getOrNull(index) == '&' -> {
                if (command.getOrNull(index) == first) index++
            }
            first in ";><()" -> Unit
            first == '$' && command.getOrNull(index).isShellNameStart() -> {
                while (command.getOrNull(index).isShellNamePart()) index++
            }
            first == '-' && (command.getOrNull(index).isShellAlphanumeric() ||
                command.getOrNull(index) == '-' && command.getOrNull(index + 1).isShellAlphanumeric()) -> {
                if (command[index] == '-') index++
                while (command.getOrNull(index).isShellNamePart() || command.getOrNull(index) == '-') index++
            }
            else -> {
                while (index < command.length && !command[index].isWhitespace() &&
                    command[index] !in "|;><()"
                ) index++
            }
        }
        yield(command.substring(start, index))
    }
}

private fun Char?.isShellNameStart(): Boolean = this != null && (this in 'a'..'z' || this in 'A'..'Z' || this == '_')
private fun Char?.isShellAlphanumeric(): Boolean = this != null && (this in 'a'..'z' || this in 'A'..'Z' || this in '0'..'9')
private fun Char?.isShellNamePart(): Boolean = isShellNameStart() || this != null && this in '0'..'9'
