# Синхронизация с оригинальным Aether

Форк сохраняет общую историю с `Zhou-Shilin/Aether`. Обновляйте его через **merge**, чтобы новые коммиты оригинала дополняли русскую сборку.

```bash
 git status
 git remote add upstream https://github.com/Zhou-Shilin/Aether.git
 git fetch upstream
 git switch main
 git branch backup/ru-before-sync
 git merge upstream/main
```

Добавление remote требуется один раз; имя резервной ветки при следующих обновлениях должно быть новым. Перед слиянием рабочее дерево должно быть чистым.

При конфликтах вручную объедините изменения, затем выполните `git add` для исправленных файлов и `git commit`. Сохраните русский README форка; обновления английского README можно перенести в `docs/README.upstream.md`.

## Что проверять

- Русские ресурсы: `shared/src/commonMain/composeResources/values-ru/`.
- Язык `Russian` в общих настройках и реализации Android.
- `ru` в `app/src/main/res/xml/locales_config.xml`.
- `adjustResize` в AndroidManifest для API ≤ 29 и выбор `adjustNothing` в MainActivity для API ≥ 30; корректное отображение чата с клавиатурой проверяйте на обеих группах устройств.
- Переводы нативных Android-настроек и расширений.
- Новые строки оригинала: добавляйте их переводы по мере появления.

```bash
./gradlew :shared:testDebugUnitTest :app:testDebugUnitTest :app:assembleDebug --no-daemon
 git diff --check
 git push origin main
```

Не используйте кнопку GitHub **Discard commits / Отбросить коммиты**, `reset --hard upstream/main` или принудительную отправку: они могут убрать изменения русской сборки из основной ветки.

## Синхронизация 3 октября 2026

Объединены три собственных коммита и 21 коммит оригинала до `7dac1ba`. Конфликты были в `README.md` и удалённом форком `README_zh.md`; код объединился автоматически. Русский README сохранён, документация оригинала вынесена отдельно, китайская версия восстановлена.

Android-изменения отправлены в [PR #102](https://github.com/Zhou-Shilin/Aether/pull/102) из ветки `fix/android-russian-chat-final-20261003`, созданной от upstream. Прежние PR #96, #99 и #101 закрыты и сохранены GitHub как история обсуждения. В новом PR нет изменений нативной реализации iOS.

PR #102 содержит только русификацию Android и исправление чата. Изменения DNS и сетевые проверки остаются отдельными изменениями форка; в upstream PR они не входят. Успешный вход через подписку ChatGPT на телефоне необходимо проверить отдельно.
