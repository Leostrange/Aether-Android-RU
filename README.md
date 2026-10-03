<p align="center"><img src="assets/leostrange-project-banner.svg" alt="Aether Android RU — русский AI-агент для Android" width="100%" /></p>

<p align="center">
  <a href="https://github.com/Leostrange/Aether-Android-RU/releases/latest"><img src="https://img.shields.io/github/v/release/Leostrange/Aether-Android-RU?style=flat-square&amp;color=7C3AED&amp;label=APK" alt="Последний релиз" /></a>
  <img src="https://img.shields.io/badge/Android-8.0%2B-3DDC84?style=flat-square&amp;logo=android&amp;logoColor=white" alt="Android 8.0+" />
  <img src="https://img.shields.io/badge/Kotlin-7F52FF?style=flat-square&amp;logo=kotlin&amp;logoColor=white" alt="Kotlin" />
  <img src="https://img.shields.io/badge/Jetpack_Compose-4285F4?style=flat-square&amp;logo=jetpackcompose&amp;logoColor=white" alt="Jetpack Compose" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-22D3EE?style=flat-square" alt="GPL 3.0" /></a>
  <a href="https://github.com/Leostrange/Aether-Android-RU/actions/workflows/build-nightly-apk.yml"><img src="https://img.shields.io/github/actions/workflow/status/Leostrange/Aether-Android-RU/build-nightly-apk.yml?branch=main&amp;style=flat-square&amp;label=build" alt="Сборка Android" /></a>
</p>

<p align="center"><b>AI-агент на Android с русским интерфейсом.</b><br/>Чат, инструменты, расширения и локальная среда выполнения — на вашем устройстве.</p>

<p align="center"><a href="https://github.com/Leostrange/Aether-Android-RU/releases/latest"><b>Скачать APK</b></a> · <a href="CHANGELOG.md">Изменения</a> · <a href="docs/SYNC.md">Синхронизация</a> · <a href="https://github.com/Leostrange/Aether-Android-RU/issues">Сообщить об ошибке</a> · <a href="https://github.com/Zhou-Shilin/Aether">Оригинал</a></p>

---

## О проекте

**Aether Android RU** — русская Android-сборка [Aether](https://github.com/Zhou-Shilin/Aether), которую поддерживает [Leostrange](https://github.com/Leostrange). Форк сохраняет историю оригинала, добавляет русификацию и исправление поведения чата при открытии клавиатуры.

Локальная среда и инструменты работают на устройстве. Запросы к облачным моделям и веб-сервисам требуют подключения к сети и настроенного провайдера.

## Возможности

| Возможность | Что доступно |
|---|---|
| Русский интерфейс | Настройки, чат, файловый менеджер и переводы разделов расширений |
| Удобный чат | Исправление схлопывания области сообщений при открытии клавиатуры |
| Расширения | Web Access, MCP Servers и Subagents |
| Среда выполнения | Интеграция с Termux и Alpine |
| Обновления оригинала | Слияние upstream с сохранением изменений форка |

## Установка

1. Откройте [последний релиз](https://github.com/Leostrange/Aether-Android-RU/releases/latest) и скачайте APK из **Assets**.
2. Установите приложение на Android **8.0+**, устройство **ARM64**.
3. Выберите русский язык в настройках и настройте провайдера модели.

Опубликованный релиз **2.1.6 Russian Android** и актуальный исходный код `main` могут различаться. Сборки из GitHub Actions доступны на [странице запусков](https://github.com/Leostrange/Aether-Android-RU/actions/workflows/build-nightly-apk.yml) как артефакты.

> APK релиза подписан debug-ключом. Если Android сообщает о несовместимой подписи при обновлении, сначала сохраните нужные данные: удаление приложения удаляет и его локальные данные.

## Скриншоты

<p align="center">
  <img src="docs/screenshots/settings-ru.jpg" width="300" alt="Настройки Aether на русском языке" />
  <img src="docs/screenshots/chat-keyboard-ru.jpg" width="300" alt="Чат Aether с открытой русской клавиатурой" />
</p>

## Сборка из исходников

Нужны **JDK 17**, **Node.js 22.19+** и Android SDK с платформой **36**. Укажите путь к SDK в локальном `local.properties` (`sdk.dir=...`) или через `ANDROID_HOME`.

```bash
./gradlew :shared:testDebugUnitTest :app:testDebugUnitTest :app:assembleDebug \
  --no-daemon --max-workers=2 -Paether.versionName=2.1.7-ru
```

В Windows используйте `gradlew.bat` вместо `./gradlew`. APK: `app/build/outputs/apk/debug/app-debug.apk`.

Для сборки в Termux задавайте `android.aapt2FromMavenOverride` в локальном `~/.gradle/gradle.properties`, указывая путь к установленному `aapt2`.

## Связь с оригиналом

- [Aether / Zhou-Shilin](https://github.com/Zhou-Shilin/Aether) — оригинальный проект и его авторы.
- [Исходный README](docs/README.upstream.md) и [中文 README](README_zh.md) — документация оригинала на момент синхронизации.
- [PR #99](https://github.com/Zhou-Shilin/Aether/pull/99) — отправленные в оригинал русификация и исправление клавиатуры; актуальный статус виден на странице PR.
- [Синхронизация форка](docs/SYNC.md) — как обновлять исходники, сохраняя собственные коммиты.

## Лицензия

[GNU GPL v3](LICENSE). Авторство оригинального проекта сохранено; сведения о сторонних компонентах — в [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
