package com.zhousl.aether.data

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class PiExtensionImportTest {
    @get:Rule
    val temporaryFolder = TemporaryFolder()

    /** Verifies that imported locked packages use npm ci with the Android download retry policy. */
    @Test
    fun usesNpmCiWhenImportedPackageHasLockfile() {
        val packageRoot = temporaryFolder.newFolder("locked")
        writeManifest(packageRoot, """{"dependencies":{"demo":"1.0.0"}}""")
        File(packageRoot, "package-lock.json").writeText("{}", Charsets.UTF_8)

        assertEquals(
            "npm ci --omit=dev --no-audit --no-fund --prefer-offline --fetch-retries=4 --fetch-retry-factor=2 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=20000",
            npmInstallPlanForPackage(packageRoot)?.command,
        )
    }

    /** Verifies that unlocked runtime packages use npm install with the same retry policy. */
    @Test
    fun usesNpmInstallWithoutLockfile() {
        val packageRoot = temporaryFolder.newFolder("unlocked")
        writeManifest(packageRoot, """{"optionalDependencies":{"demo":"1.0.0"}}""")

        assertEquals(
            "npm install --omit=dev --no-audit --no-fund --prefer-offline --fetch-retries=4 --fetch-retry-factor=2 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=20000",
            npmInstallPlanForPackage(packageRoot)?.command,
        )
    }

    @Test
    fun skipsInstallWithoutRuntimeDependenciesOrWithBundledModules() {
        val noDependencies = temporaryFolder.newFolder("none")
        writeManifest(noDependencies, """{"devDependencies":{"demo":"1.0.0"}}""")
        assertNull(npmInstallPlanForPackage(noDependencies))

        val bundled = temporaryFolder.newFolder("bundled")
        writeManifest(bundled, """{"dependencies":{"demo":"1.0.0"}}""")
        File(bundled, "node_modules").mkdirs()
        assertNull(npmInstallPlanForPackage(bundled))
    }

    private fun writeManifest(
        packageRoot: File,
        json: String,
    ) {
        File(packageRoot, "package.json").writeText(json, Charsets.UTF_8)
    }
}
