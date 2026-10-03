package com.zhousl.aether.runtime

import java.io.File
import java.io.FileNotFoundException
import java.nio.file.FileAlreadyExistsException
import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class AlpineDocumentStoreTest {
    @get:Rule val temporaryFolder = TemporaryFolder()
    private lateinit var runtimeRoot: File
    private lateinit var rootfs: File
    private lateinit var workspace: File
    private lateinit var store: AlpineDocumentStore

    @Before
    fun setUp() {
        runtimeRoot = temporaryFolder.newFolder("alpine")
        rootfs = File(runtimeRoot, "rootfs").apply { mkdir() }
        workspace = File(runtimeRoot, "workspace").apply { mkdir() }
        File(runtimeRoot, ".installed-version").writeText("fixture")
        store = AlpineDocumentStore(runtimeRoot)
    }

    @Test
    fun onlyPublishesAnInstalledEnvironmentWithoutCreatingDirectories() {
        assertTrue(store.isAvailable)
        File(runtimeRoot, ".installed-version").delete()
        assertFalse(store.isAvailable)
        assertThrows(FileNotFoundException::class.java) { store.document("alpine:/") }
        runtimeRoot.deleteRecursively()
        assertFalse(store.isAvailable)
        assertFalse(runtimeRoot.exists())
    }

    @Test
    fun workspaceUsesTheProotBindInsteadOfTheRootfsPlaceholder() {
        File(rootfs, "workspace").mkdir()
        File(rootfs, "workspace/hidden.txt").writeText("shadowed")
        File(workspace, "visible.txt").writeText("guest content")

        assertEquals(1, store.children("alpine:/").count { it.displayName == "workspace" })
        assertEquals(listOf("visible.txt"), store.children("alpine:/workspace").map { it.displayName })
        assertEquals("guest content", store.contentFile("alpine:/workspace/visible.txt").readText())
        assertThrows(FileNotFoundException::class.java) { store.document("alpine:/workspace/hidden.txt") }
    }

    @Test
    fun hostSystemMountsAreNeitherListedNorAccessibleByForgedIds() {
        listOf("dev", "proc", "sys").forEach { name ->
            File(rootfs, name).mkdir()
            File(rootfs, "$name/private.txt").writeText("not exported")
            assertThrows(FileNotFoundException::class.java) { store.document("alpine:/$name/private.txt") }
        }
        assertEquals(listOf("workspace"), store.children("alpine:/").map { it.displayName })
    }

    @Test
    fun invalidIdsAndNamesCannotEscapeOrAliasTheNamespace() {
        val ids = listOf(
            "/etc/passwd", "other:/", "alpine:relative", "alpine:/../outside",
            "alpine:/workspace/../root", "alpine:/workspace/.", "alpine://workspace",
            "alpine:/workspace/", "alpine:/workspace\u0000/secret",
        )
        ids.forEach { id -> assertThrows(id, FileNotFoundException::class.java) { store.document(id) } }
        listOf("", ".", "..", "../outside", "/absolute", "a/b", "a\u0000b").forEach { name ->
            assertThrows(FileNotFoundException::class.java) { store.create("alpine:/workspace", name, false) }
        }
    }

    @Test
    fun createAndRenamePreserveDataAndAvoidOverwritingExistingFiles() {
        val folder = store.create("alpine:/workspace", "项目 #1", true)
        val original = store.create(folder, "notes.txt", false)
        store.contentFile(original).writeText("keep me")
        val duplicate = store.create(folder, "notes.txt", false)

        assertEquals("alpine:/workspace/项目 #1/notes (1).txt", duplicate)
        assertEquals("keep me", store.contentFile(original).readText())
        assertThrows(FileAlreadyExistsException::class.java) { store.rename(duplicate, "notes.txt") }
        val renamed = store.rename(original, "renamed.txt")
        assertEquals("keep me", store.contentFile(renamed).readText())
        assertThrows(FileNotFoundException::class.java) { store.document(original) }
        store.delete(folder)
        assertFalse(File(workspace, "项目 #1").exists())
    }

    @Test
    fun rootAndWorkspaceCannotBeRenamedOrDeletedEvenThroughAnAlias() {
        File(rootfs, "root").mkdir()
        Files.createSymbolicLink(File(rootfs, "root/all").toPath(), File("/").toPath())
        listOf("alpine:/", "alpine:/workspace", "alpine:/root/all/workspace").forEach { id ->
            assertTrue(store.document(id).isProtected)
            assertThrows(FileNotFoundException::class.java) { store.delete(id) }
            assertThrows(FileNotFoundException::class.java) { store.rename(id, "moved") }
        }
        assertTrue(workspace.isDirectory)
    }

    @Test
    fun absoluteAndRelativeLinksResolveInsideTheGuestIncludingWorkspace() {
        File(rootfs, "root").mkdir()
        File(workspace, "hello.txt").writeText("from proot")
        Files.createSymbolicLink(File(rootfs, "root/files").toPath(), File("/workspace").toPath())
        Files.createSymbolicLink(File(rootfs, "root/hello").toPath(), File("../workspace/hello.txt").toPath())

        assertEquals("from proot", store.contentFile("alpine:/root/files/hello.txt").readText())
        assertEquals("from proot", store.contentFile("alpine:/root/hello").readText())
        val created = store.create("alpine:/root/files", "new.txt", false)
        store.contentFile(created).writeText("written through a guest link")
        assertEquals("written through a guest link", File(workspace, "new.txt").readText())
    }

    @Test
    fun hostAbsoluteLinksAndParentTraversalNeverExposeAppPrivateFiles() {
        val secret = temporaryFolder.newFile("private.txt").apply { writeText("app secret") }
        Files.createSymbolicLink(File(workspace, "absolute").toPath(), secret.toPath())
        Files.createSymbolicLink(File(workspace, "relative").toPath(), File("../../private.txt").toPath())
        listOf("absolute", "relative").forEach { name ->
            val id = "alpine:/workspace/$name"
            assertTrue(store.document(id).isSymbolicLink)
            assertThrows(FileNotFoundException::class.java) { store.contentFile(id) }
            store.delete(id)
        }
        assertEquals("app secret", secret.readText())
    }

    @Test
    fun treeGrantsCheckPathBoundariesAndResolvedLinkTargets() {
        File(workspace, "shared").mkdir()
        File(workspace, "shared/allowed.txt").writeText("allowed")
        File(workspace, "shared-other").mkdir()
        File(workspace, "shared-other/private.txt").writeText("private")
        Files.createSymbolicLink(File(workspace, "shared/escape").toPath(), File("../shared-other").toPath())

        assertTrue(store.isChild("alpine:/", "alpine:/workspace/shared/allowed.txt"))
        assertTrue(store.isChild("alpine:/workspace/shared", "alpine:/workspace/shared/allowed.txt"))
        assertFalse(store.isChild("alpine:/workspace/shared", "alpine:/workspace/shared-other/private.txt"))
        assertFalse(store.isChild("alpine:/workspace/shared", "alpine:/workspace/shared/escape/private.txt"))
        assertFalse(store.isChild("alpine:/workspace/shared", "alpine:/workspace/shared/escape"))
        assertFalse(store.isChild("alpine:/workspace/shared", "alpine:/workspace/shared/../shared-other"))
        assertEquals(
            listOf("alpine:/workspace/shared", "alpine:/workspace/shared/allowed.txt"),
            store.documentPath("alpine:/workspace/shared", "alpine:/workspace/shared/allowed.txt"),
        )
        assertThrows(FileNotFoundException::class.java) {
            store.documentPath("alpine:/workspace/shared", "alpine:/workspace/shared/escape/private.txt")
        }
    }

    @Test
    fun renameAndRecursiveDeletionOperateOnLinksWithoutDeletingTheirTargets() {
        File(workspace, "keep").mkdir()
        File(workspace, "keep/important.txt").writeText("keep")
        File(workspace, "remove").mkdir()
        Files.createSymbolicLink(File(workspace, "remove/link").toPath(), File("../keep").toPath())
        store.rename("alpine:/workspace/remove/link", "renamed")
        assertTrue(Files.isSymbolicLink(File(workspace, "remove/renamed").toPath()))
        store.delete("alpine:/workspace/remove")
        assertEquals("keep", File(workspace, "keep/important.txt").readText())
    }

    @Test
    fun brokenAndCyclicLinksDoNotHangListingsOrGetOverwrittenOnCreate() {
        Files.createSymbolicLink(File(workspace, "broken").toPath(), File("missing").toPath())
        Files.createSymbolicLink(File(workspace, "loop").toPath(), File("loop").toPath())
        assertEquals(2, store.children("alpine:/workspace").size)
        assertEquals("alpine:/workspace/broken (1)", store.create("alpine:/workspace", "broken", false))
        assertThrows(FileNotFoundException::class.java) { store.contentFile("alpine:/workspace/loop") }
        store.delete("alpine:/workspace/loop")
    }

    @Test
    fun documentIdsAndBreadcrumbsSurviveReopeningTheStore() {
        File(workspace, "file.txt").writeText("persistent")
        val reopened = AlpineDocumentStore(runtimeRoot)
        assertEquals("persistent", reopened.contentFile("alpine:/workspace/file.txt").readText())
        assertEquals(
            listOf("alpine:/", "alpine:/workspace", "alpine:/workspace/file.txt"),
            reopened.documentPath(null, "alpine:/workspace/file.txt"),
        )
    }
}
