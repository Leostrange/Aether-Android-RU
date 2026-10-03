package com.zhousl.aether.data

import com.zhousl.aether.data.chatdb.PersistedChatSession
import com.zhousl.aether.data.chatdb.PersistedChatMessage
import com.zhousl.aether.data.chatdb.PersistedChatTool
import com.zhousl.aether.data.chatdb.PersistedAssistantResponseBlock
import com.zhousl.aether.data.chatdb.PersistedAssistantResponseBlockType
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.launch
import org.junit.Assert.*
import org.junit.Test

class ShowcasePlaybackTest {
    private val user = PersistedChatMessage("user", "Inspect the project", true)
    private val assistant = PersistedChatMessage(
        id = "assistant", text = "Finished.", fromUser = false,
        responseBlocks = listOf(
            PersistedAssistantResponseBlock("tools", PersistedAssistantResponseBlockType.ToolGroup, tools = listOf(
                PersistedChatTool("call", "bash", "pwd", output = "/workspace", argumentsJson = "{\"command\":\"pwd\"}", outputJson = "{\"stdout\":\"/workspace\"}"),
            )),
            PersistedAssistantResponseBlock("text", PersistedAssistantResponseBlockType.Text, text = "Finished."),
        ),
    )
    private val session = PersistedChatSession("showcase-v1-test", "Test", "", listOf(user, assistant))

    @Test fun playbackHidesFutureOutputAndRestoresCanonicalTranscript() = runTest {
        val frames = mutableListOf<Pair<List<PersistedChatMessage>, PersistedChatMessage?>>()
        ShowcasePlayback().play(session) { completed, pending -> frames += completed to pending }
        assertTrue(frames.first().first.isEmpty())
        val running = frames.mapNotNull { it.second }.flatMap { it.responseBlocks }.flatMap { it.tools }.first { it.isRunning }
        assertEquals("", running.output)
        assertEquals("", running.outputJson)
        assertNull(running.completedAtMillis)
        assertEquals(listOf(user, assistant), frames.last().first)
        assertNull(frames.last().second)
    }

    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    @Test fun pausedPlaybackDoesNotAdvanceAndCanResume() = runTest {
        val player = ShowcasePlayback().also { it.paused = true }
        var count = 0
        val job = launch { player.play(session) { _, _ -> count++ } }
        runCurrent()
        assertEquals(1, count)
        advanceTimeBy(5000)
        assertEquals(1, count)
        player.paused = false
        job.join()
        assertTrue(count > 1)
    }
}
