package com.zhousl.aether.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.DoneAll
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import com.zhousl.aether.ui.theme.AetherSurface
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

data class ShowcaseControls(
    val playing: Boolean,
    val paused: Boolean,
    val speed: Float,
    val onReplay: () -> Unit,
    val onPause: () -> Unit,
    val onRestore: () -> Unit,
    val onSpeed: (Float) -> Unit,
)

val LocalShowcaseControls = staticCompositionLocalOf<ShowcaseControls?> { null }

@Composable
fun ShowcasePlaybackButton(controls: ShowcaseControls) {
    var expanded by remember { mutableStateOf(false) }
    Box(Modifier.padding(end = 8.dp)) {
        HeaderCircleButton(
            icon = if (controls.playing && !controls.paused) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
            contentDescription = "Replay controls",
            onClick = { expanded = true }, size = 38.dp, iconSize = 19.dp,
            containerColor = AetherSurface.copy(alpha = 0.96f),
        )
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text("Replay from beginning") },
                leadingIcon = { Icon(LucideIcons.RotateCcw, null) },
                onClick = { expanded = false; controls.onReplay() },
            )
            if (controls.playing) DropdownMenuItem(
                text = { Text(if (controls.paused) "Resume" else "Pause") },
                leadingIcon = { Icon(if (controls.paused) Icons.Rounded.PlayArrow else Icons.Rounded.Pause, null) },
                onClick = { expanded = false; controls.onPause() },
            )
            DropdownMenuItem(
                text = { Text("Show completed session") },
                leadingIcon = { Icon(Icons.Rounded.DoneAll, null) },
                onClick = { expanded = false; controls.onRestore() },
            )
            listOf(0.5f, 1f, 2f, 5f).forEach { speed ->
                DropdownMenuItem(
                    text = { Text("${speed}x${if (controls.speed == speed) "  •" else ""}") },
                    onClick = { controls.onSpeed(speed); expanded = false },
                )
            }
        }
    }
}

@Composable
fun ShowcaseSkillBadge(messageId: String, payload: String) {
    if (!messageId.startsWith("showcase-v1-")) return
    val name = remember(payload) {
        runCatching { Json.parseToJsonElement(payload).jsonObject["showcaseSkill"]?.jsonPrimitive?.content }
            .getOrNull().orEmpty()
    }
    if (name.isBlank()) return
    Surface(shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.secondaryContainer) {
        Row(Modifier.padding(horizontal = 10.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.AutoAwesome, null, Modifier.size(14.dp))
            Text(name, style = MaterialTheme.typography.labelMedium)
        }
    }
}
