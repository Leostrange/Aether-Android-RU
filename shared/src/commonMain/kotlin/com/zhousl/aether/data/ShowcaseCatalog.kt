package com.zhousl.aether.data

import com.zhousl.aether.data.chatdb.PersistedChatSession
import com.zhousl.aether.data.chatdb.PersistedChatMessage
import com.zhousl.aether.data.chatdb.PersistedAssistantResponseBlock
import com.zhousl.aether.data.chatdb.PersistedAssistantResponseBlockType
import com.zhousl.aether.shared.resources.Res
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import org.jetbrains.compose.resources.ExperimentalResourceApi
import kotlin.random.Random

object ShowcaseCatalog {
    const val sessionPrefix = "showcase-v1-"
    fun isSession(id: String) = id.startsWith(sessionPrefix)

    @OptIn(ExperimentalResourceApi::class)
    suspend fun load(android: Boolean): List<PersistedChatSession> = Json.decodeFromString(
        Res.readBytes("files/showcase/${if (android) "catalog" else "catalog-ios"}.json").decodeToString(),
    )

    fun providers(): List<LlmProviderConfig> = listOf(
        Triple("openai", "OpenAI", "gpt-6-astra"),
        Triple("google", "Google", "gemini-3.8-flash"),
        Triple("anthropic", "Anthropic", "claude-fable-5.1"),
    ).map { (provider, label, model) ->
        LlmProviderConfig(
            id = "showcase-$provider", providerId = provider, name = label,
            piProviderId = provider, apiKey = "", baseUrl = "http://127.0.0.1:1/offline-showcase",
            modelId = model, manualModelIds = listOf(model), enabledModelIds = listOf(model),
        )
    }
}

/** Emits normal chat blocks so the production renderer supplies all streaming animations. */
class ShowcasePlayback {
    var paused = false
    var speed = 1f

    private suspend fun waitBetween(min: Long, max: Long) {
        var remaining = Random.nextLong(min, max + 1).toFloat()
        while (remaining > 0) {
            delay(25)
            if (!paused) remaining -= 25 * speed.coerceIn(0.5f, 8f)
        }
    }

    suspend fun play(
        session: PersistedChatSession,
        onFrame: suspend (List<PersistedChatMessage>, PersistedChatMessage?) -> Unit,
    ) {
        val completed = mutableListOf<PersistedChatMessage>()
        onFrame(emptyList(), null)
        waitBetween(500, 900)
        for (message in session.messages) {
            if (message.fromUser) {
                completed += message
                onFrame(completed.toList(), null)
                waitBetween(900, 1600)
                continue
            }
            val blocks = mutableListOf<PersistedAssistantResponseBlock>()
            val start = platformCurrentTimeMillis()
            suspend fun publish() = onFrame(
                completed.toList(), message.copy(
                    text = "", responseBlocks = blocks.toList(), attachments = emptyList(),
                    tools = emptyList(), usage = null, createdAtMillis = start,
                    completedAtMillis = null, thoughtDurationMillis = 0, responseDurationMillis = 0,
                ),
            )
            publish()
            waitBetween(700, 1300)
            for (block in message.responseBlocks) {
                when (block.type) {
                    PersistedAssistantResponseBlockType.Text -> {
                        blocks += block.copy(text = "")
                        var end = 0
                        while (end < block.text.length) {
                            end = (end + Random.nextInt(5, 15)).coerceAtMost(block.text.length)
                            blocks[blocks.lastIndex] = block.copy(text = block.text.take(end))
                            publish()
                            waitBetween(24, 65)
                        }
                        waitBetween(350, 650)
                    }
                    PersistedAssistantResponseBlockType.ToolGroup -> {
                        blocks += block.copy(tools = emptyList())
                        val tools = mutableListOf<com.zhousl.aether.data.chatdb.PersistedChatTool>()
                        block.tools.forEachIndexed { index, tool ->
                            val now = platformCurrentTimeMillis()
                            tools += tool.copy(isRunning = true, output = "", outputJson = "", startedAtMillis = now, completedAtMillis = null, startedAtUptimeMillis = 0, completedAtUptimeMillis = null)
                            blocks[blocks.lastIndex] = block.copy(tools = tools.toList())
                            publish()
                            if (index < 8) waitBetween(850, 1850) else waitBetween(170, 570)
                            tools[tools.lastIndex] = tool.copy(startedAtMillis = now, completedAtMillis = platformCurrentTimeMillis(), startedAtUptimeMillis = 0, completedAtUptimeMillis = null)
                            blocks[blocks.lastIndex] = block.copy(tools = tools.toList())
                            publish()
                            waitBetween(70, 190)
                        }
                    }
                    else -> { blocks += block; publish() }
                }
            }
            completed += message
            onFrame(completed.toList(), null)
            waitBetween(1600, 2600)
        }
    }
}
