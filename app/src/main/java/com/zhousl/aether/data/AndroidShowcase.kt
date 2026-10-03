package com.zhousl.aether.data

import com.zhousl.aether.data.chatdb.PersistedChatSession
import com.zhousl.aether.data.chatdb.serializePersistedChatSession
import com.zhousl.aether.ui.ChatSession
import com.zhousl.aether.ui.AssistantResponseBlock
import com.zhousl.aether.ui.ChatToolInvocation
import com.zhousl.aether.data.chatdb.PersistedChatMessage
import com.zhousl.aether.data.chatdb.PersistedAssistantResponseBlockType
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject

object AndroidShowcase {
    private val mutex = Mutex()
    private var catalog: List<PersistedChatSession>? = null

    suspend fun catalog(): List<PersistedChatSession> = mutex.withLock {
        catalog ?: ShowcaseCatalog.load(android = true).also { catalog = it }
    }

    fun convert(session: PersistedChatSession): ChatSession = parseChatSessions(
        JSONArray().put(JSONObject(serializePersistedChatSession(session)).getJSONObject("session")).toString(),
    ).single()

    suspend fun sessions(): List<ChatSession> = catalog().map(::convert)

    fun pendingBlocks(message: PersistedChatMessage): List<AssistantResponseBlock> = message.responseBlocks.map { block ->
        when (block.type) {
            PersistedAssistantResponseBlockType.ToolGroup -> AssistantResponseBlock.ToolGroup(block.id, block.tools.map { tool ->
                ChatToolInvocation(
                    id = tool.id, toolName = tool.name, argumentsJson = tool.argumentsJson,
                    outputJson = tool.outputJson, isRunning = tool.isRunning,
                    startedAtMillis = tool.startedAtMillis, completedAtMillis = tool.completedAtMillis,
                    timelineOrder = tool.timelineOrder,
                )
            })
            else -> AssistantResponseBlock.Text(block.id, block.text)
        }
    }
}
