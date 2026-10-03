package com.zhousl.aether.ui

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.changedToUp
import androidx.compose.ui.input.pointer.isOutOfBounds
import androidx.compose.ui.input.pointer.pointerInput

internal fun Modifier.dismissKeyboardOnBackgroundTap(onDismiss: () -> Unit): Modifier =
    pointerInput(onDismiss) {
        awaitEachGesture {
            // Observe after children so text fields, buttons, selection and scrolling win.
            // Never consume events: this listener must not take over their gestures.
            val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Final)
            if (down.isConsumed || currentEvent.changes.size != 1) return@awaitEachGesture

            val touchSlopSquared = viewConfiguration.touchSlop * viewConfiguration.touchSlop
            val longPressTimeout = viewConfiguration.longPressTimeoutMillis
            while (true) {
                val event = awaitPointerEvent(PointerEventPass.Final)
                val change = event.changes.singleOrNull() ?: return@awaitEachGesture
                if (
                    change.id != down.id || change.isConsumed ||
                    change.uptimeMillis - down.uptimeMillis >= longPressTimeout ||
                    change.isOutOfBounds(size, extendedTouchPadding) ||
                    (change.position - down.position).getDistanceSquared() > touchSlopSquared ||
                    change.historical.any {
                        (it.position - down.position).getDistanceSquared() > touchSlopSquared
                    }
                ) {
                    // Once canceled, awaitEachGesture waits for every finger to lift.
                    // Moving back to the starting point must not turn a drag into a tap.
                    return@awaitEachGesture
                }
                if (change.changedToUp()) {
                    onDismiss()
                    return@awaitEachGesture
                }
            }
        }
    }
