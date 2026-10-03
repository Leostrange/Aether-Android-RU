package com.zhousl.aether.runtime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class AlpineNetworkConfigTest {
    /** VPN DNS must replace public resolvers so queries stay on the selected network. */
    @Test
    fun vpnDnsReplacesPublicServers() {
        val config = alpineResolverConfiguration(listOf("10.8.0.1", "10.8.0.1"))
        assertEquals("nameserver 10.8.0.1\noptions timeout:2 attempts:2\n", config)
        assertFalse(config.contains("1.1.1.1"))
        assertFalse(config.contains("8.8.8.8"))
    }

    /** A changed network must produce fresh resolver content instead of stale VPN DNS. */
    @Test
    fun networkChangeReplacesOldDnsAndPreservesIpv6Scope() {
        val old = alpineResolverConfiguration(listOf("10.8.0.1"))
        val current = alpineResolverConfiguration(listOf("fe80::1%wlan0", "192.168.1.1"))
        assertFalse(current == old)
        assertFalse(current.contains("10.8.0.1"))
        assertEquals("nameserver fe80::1%wlan0\nnameserver 192.168.1.1\noptions timeout:2 attempts:2\n", current)
    }

    /** Offline or unavailable link properties retain the previous public-DNS fallback. */
    @Test
    fun unavailableDnsUsesFallback() {
        assertEquals("nameserver 1.1.1.1\nnameserver 8.8.8.8\noptions timeout:2 attempts:2\n",
            alpineResolverConfiguration(listOf("", " ")))
    }
}
