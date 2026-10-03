package com.zhousl.aether.data

import kotlin.math.roundToInt

/**
 * Coordinate contract for the `agent_display` tool.
 *
 * Tap and swipe take coordinates normalized to 0..1000 on each axis, independent of the display
 * resolution and of the (downscaled) screenshot resolution the model sees. Tool results report the
 * resolved point in both spaces so the model can check where a gesture actually landed.
 */
internal const val AgentModeNormalizedCoordinateMax = 1000

internal sealed interface AgentModeCoordinateResult {
    data class Valid(val pixel: Int) : AgentModeCoordinateResult
    data object Missing : AgentModeCoordinateResult
    data class OutOfRange(val message: String) : AgentModeCoordinateResult
}

/**
 * Converts one normalized coordinate to a display pixel. Values outside 0..1000 are rejected instead
 * of clamped: a clamped pixel coordinate (for example x=1080 on a 1080px wide display) would silently
 * tap the screen edge, which is how issue #89 manifested.
 */
internal fun resolveAgentModeCoordinate(
    name: String,
    value: Double,
    displayExtent: Int,
): AgentModeCoordinateResult {
    if (value.isNaN()) return AgentModeCoordinateResult.Missing
    if (value.isInfinite() || value < 0.0 || value > AgentModeNormalizedCoordinateMax) {
        return AgentModeCoordinateResult.OutOfRange(
            "'$name'=${formatCoordinate(value)} is outside the normalized 0..$AgentModeNormalizedCoordinateMax range. " +
                "Coordinates are not screenshot or display pixels: use " +
                "$name = pixel / image_${if (name.startsWith("x")) "width" else "height"} * $AgentModeNormalizedCoordinateMax.",
        )
    }
    val extent = displayExtent.coerceAtLeast(1)
    val pixel = (value / AgentModeNormalizedCoordinateMax * extent).roundToInt().coerceIn(0, extent - 1)
    return AgentModeCoordinateResult.Valid(pixel)
}

/** Converts a display pixel back to the normalized 0..1000 space. */
internal fun normalizeAgentModePixel(pixel: Int, displayExtent: Int): Int {
    val extent = displayExtent.coerceAtLeast(1)
    return (pixel.toDouble() / extent * AgentModeNormalizedCoordinateMax)
        .roundToInt()
        .coerceIn(0, AgentModeNormalizedCoordinateMax)
}

/** Size of the JPEG screenshot after the capture service scales its longest edge down to [maxEdge]. */
internal fun agentModeScreenshotSize(width: Int, height: Int, maxEdge: Int): Pair<Int, Int> {
    val safeWidth = width.coerceAtLeast(1)
    val safeHeight = height.coerceAtLeast(1)
    val largestEdge = maxOf(safeWidth, safeHeight)
    if (largestEdge <= maxEdge) return safeWidth to safeHeight
    val scale = maxEdge.toFloat() / largestEdge.toFloat()
    return (safeWidth * scale).toInt().coerceAtLeast(1) to (safeHeight * scale).toInt().coerceAtLeast(1)
}

private fun formatCoordinate(value: Double): String =
    if (value == value.toLong().toDouble()) value.toLong().toString() else value.toString()
