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
- Язык `Russian` в общих настройках и платформах Android/iOS.
- `ru` в `app/src/main/res/xml/locales_config.xml`.
- `android:windowSoftInputMode="adjustNothing"` в AndroidManifest и корректное отображение чата с клавиатурой на устройстве.
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

Изменения в `main` форка не обновляют автоматически [PR #96](https://github.com/Zhou-Shilin/Aether/pull/96): он использует отдельную ветку `aether-2.1.6-russian-localization-chat-fix`.
