package com.zhousl.aether.data

import com.zhousl.aether.agentmode.parseInputDispatcherFocus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AgentModeCoordinatesTest {
    @Test
    fun normalizedCoordinatesMapToDisplayPixels() {
        // Values from issue #89: x=480, y=936 on a 1080x2400 display.
        assertEquals(AgentModeCoordinateResult.Valid(518), resolveAgentModeCoordinate("x", 480.0, 1080))
        assertEquals(AgentModeCoordinateResult.Valid(2246), resolveAgentModeCoordinate("y", 936.0, 2400))
    }

    @Test
    fun edgesStayInsideTheDisplay() {
        assertEquals(AgentModeCoordinateResult.Valid(0), resolveAgentModeCoordinate("x", 0.0, 1080))
        assertEquals(AgentModeCoordinateResult.Valid(1079), resolveAgentModeCoordinate("x", 1000.0, 1080))
    }

    @Test
    fun pixelLikeValuesAreRejectedInsteadOfClamped() {
        val result = resolveAgentModeCoordinate("x", 1080.0, 1080)
        assertTrue(result is AgentModeCoordinateResult.OutOfRange)
        val message = (result as AgentModeCoordinateResult.OutOfRange).message
        assertTrue(message.contains("0..1000"))
        assertTrue(message.contains("image_width"))
        assertTrue(resolveAgentModeCoordinate("y", -1.0, 2400) is AgentModeCoordinateResult.OutOfRange)
    }

    @Test
    fun missingCoordinateIsReported() {
        assertEquals(AgentModeCoordinateResult.Missing, resolveAgentModeCoordinate("x", Double.NaN, 1080))
    }

    @Test
    fun pixelsNormalizeBack() {
        assertEquals(480, normalizeAgentModePixel(518, 1080))
        assertEquals(936, normalizeAgentModePixel(2246, 2400))
    }

    @Test
    fun screenshotSizeMatchesCaptureScaling() {
        assertEquals(576 to 1280, agentModeScreenshotSize(1080, 2400, 1280))
        assertEquals(800 to 600, agentModeScreenshotSize(800, 600, 1280))
    }

    @Test
    fun parsesFocusedWindowForDisplay() {
        val dump = """
            Input Dispatcher State:
              FocusedDisplayId: 0
              FocusedApplications:
                displayId=0, name='ActivityRecord{1 u0 com.example/.Main t1}', dispatchingTimeout=5000ms
                displayId=2, name='ActivityRecord{2 u0 com.tencent.mm/.ui.LauncherUI t9}', dispatchingTimeout=5000ms
              FocusedWindows:
                displayId=0, name='919023c NotificationShade'
                displayId=2, name='abc123 com.tencent.mm/com.tencent.mm.ui.LauncherUI'
              FocusRequests:
        """.trimIndent()
        val focus = parseInputDispatcherFocus(dump, 2)
        assertEquals("abc123 com.tencent.mm/com.tencent.mm.ui.LauncherUI", focus.getString("focused_window"))
        assertEquals("ActivityRecord{2 u0 com.tencent.mm/.ui.LauncherUI t9}", focus.getString("focused_application"))
    }

    @Test
    fun reportsEmptyFocusWhenDisplayHasNoFocusedWindow() {
        val dump = """
              FocusedApplications:
                displayId=0, name='ActivityRecord{1 u0 com.example/.Main t1}', dispatchingTimeout=5000ms
              FocusedWindows:
                displayId=0, name='919023c NotificationShade'
              FocusRequests:
        """.trimIndent()
        val focus = parseInputDispatcherFocus(dump, 2)
        assertTrue(focus.has("focused_window"))
        assertEquals("", focus.getString("focused_window"))
        assertEquals("", parseInputDispatcherFocus("  FocusedWindows: <none>\n", 2).getString("focused_window"))
    }

    @Test
    fun unknownFocusWhenDumpHasNoDispatcherSection() {
        assertFalse(parseInputDispatcherFocus("dumpsys failed", 2).has("focused_window"))
    }
}
