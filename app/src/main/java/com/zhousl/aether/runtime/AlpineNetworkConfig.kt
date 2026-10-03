package com.zhousl.aether.runtime

/**
 * Uses the active Android network's DNS, including VPN resolvers. Public fallback
 * servers are used only when Android exposes none, never alongside VPN servers.
 * IPv6 scope identifiers are retained for link-local resolvers.
 */
internal fun alpineResolverConfiguration(dnsServers: List<String>): String {
    val servers = dnsServers.filter { it.isNotBlank() }.distinct()
        .ifEmpty { listOf("1.1.1.1", "8.8.8.8") }
    return servers.joinToString("\n") { "nameserver $it" } +
        "\noptions timeout:2 attempts:2\n"
}
