package com.zhousl.aether.ui

import com.zhousl.aether.data.AppLanguage
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.serialization.json.Json

class ExtensionLocalizationTest {
    @Test
    fun keepsOtherLanguagesAndUnknownTextIntact() {
        AppLanguage.entries.filter { it != AppLanguage.Russian }.forEach { language ->
            assertEquals("Web Access", extensionText("Web Access", language))
            assertEquals("Search workflow updated", extensionText("Search workflow updated", language))
        }
        assertEquals("Custom title", extensionText("Custom title", AppLanguage.Russian))
        assertEquals("Веб-доступ", extensionText("Web Access", AppLanguage.Russian))
        assertEquals("Процесс поиска обновлён", extensionText("Search workflow updated", AppLanguage.Russian))
    }

    @Test
    fun translatesNotificationWithoutChangingErrorDetail() {
        val message = "Web Access settings could not read the Pi config: ENOENT /data/pi/config.json"
        assertEquals(message, extensionText(message, AppLanguage.English))
        assertEquals("Настройки веб-доступа: не удалось прочитать конфигурацию Pi: ENOENT /data/pi/config.json", extensionText(message, AppLanguage.Russian))
    }

    @Test
    fun translatesSchemaLabelsWithoutChangingActionArgumentsOrValues() {
        val source = Json.parseToJsonElement("""{"title":"Web Access","settings":[{"label":"Provider","value":"Provider","args":{"title":"Web Access"},"options":[{"label":"Runtime","value":"Runtime"}]}]}""")
        val expected = Json.parseToJsonElement("""{"title":"Веб-доступ","settings":[{"label":"Провайдер","value":"Provider","args":{"title":"Web Access"},"options":[{"label":"Среда выполнения","value":"Runtime"}]}]}""")
        assertEquals(expected, localizeExtensionSettings(source, AppLanguage.Russian))
        assertEquals(source, localizeExtensionSettings(source, AppLanguage.English))
    }

    @Test
    fun translatesKnownMenuItemsOnlyInRussian() {
        assertEquals("Субагенты", extensionComposerMenuTitle("subagents", "Subagents", AppLanguage.Russian))
        assertEquals("Исследование в интернете", extensionComposerMenuTitle("research-web", "Research on the web", AppLanguage.Russian))
        AppLanguage.entries.filter { it != AppLanguage.Russian }.forEach { language ->
            assertEquals("Subagents", extensionComposerMenuTitle("subagents", "Subagents", language))
            assertEquals("Research on the web", extensionComposerMenuTitle("research-web", "Research on the web", language))
        }
    }

    @Test
    fun preservesUnknownExtensionTitles() {
        assertEquals("Custom title", extensionComposerMenuTitle("custom", "Custom title", AppLanguage.Russian))
    }
}
