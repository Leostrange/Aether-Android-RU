# Aether Film Sessions

These are scripted, offline film fixtures. Tool commands, model names, elapsed
times, and completion claims are simulated. Nothing in the fixture executes SSH,
root repair, model requests, or website deployment.

Android uses the existing `demo` build type, app name `Aether Showcase`, and
application ID `com.baimoqilin.aether.showcase`. The stable application remains
installed independently. Build with `./gradlew :app:assembleDemo --no-daemon`.

iOS opts in only when `Documents/aether-showcase-enabled` exists in its app data
container. The marker is not bundled. Existing conversations are retained. On both
platforms, the scripted conversations restore their complete contents at launch,
including updated attachments, while retaining their selected model. Remove the
iOS marker to disable the filming controls.

The catalog contains 14 Android conversations and 12 iOS conversations: separate
Chinese and English versions of each task, with Readest restricted to Android.
Both website conversations have eight user turns and eight logical Agent turns.
Android stores the progress text, tool group, and final text as separate existing
renderer blocks within each response group.

The play icon beside New Chat opens replay controls. Replay starts from an empty
conversation and uses the existing message/tool renderers. Pause, resume, 0.5x,
1x, 2x, 5x, and restore-completed controls are available. Each replay has random
delays. The first eight calls have longer dwell times for filming expanded tools.
Completed transcripts preserve the estimated task durations in `estimates.json`.
Images and downloadable deliverables remain visible after the final reply, outside
the collapsed work group. Chinese PDFs embed their font for portable rendering.

`catalog.mjs` is the authored transcript source. `assets.py` creates local artwork,
PDFs, and attachment props. Regenerate with the bundled Python runtime (Pillow and
ReportLab), then `node scripts/showcase/catalog.mjs`. The three reference uploads
reuse `public/chat.jpg`, as agreed. Public-domain source text is Project Gutenberg
ebook 24032. Attachment props carry their offline provenance internally.

Generated catalog JSON is bundled through Compose resources. Tools in the first
eight positions include concrete argument and output records. Later calls are
collapsed placeholders. The fictional API key appears only in the requested
user prompt; no live provider credential is configured.

## Filming controls

Open a Chinese or English conversation from the sidebar. On Android, launch
**Aether Showcase**, not the separately installed Aether app. Its model selector
contains `gpt-6-astra`, `gemini-3.8-flash`, and `claude-fable-5.1`.

Use the play button beside New Chat, then **Replay from beginning**. **Pause** and
**Resume** hold a tool or streaming reply for a shot. **Show completed session**
restores every turn and attachment immediately. Speed changes apply to the active
replay; choose 0.5x for close-ups or 5x for a quick complete run.

For the tool-detail shot, expand **Working for ...**, then **Executed ... tools**,
then open one of the first eight calls. These contain authored arguments and
outputs. The website conversations, **把 Aether 放上项目页** and
**Aether on the Projects page**, each have eight prompts for the conversation
timeline. The screenshots and translation-extension prompts display their skill
badges; the screenshot prompt has three copies of the same reference image.

All tasks are scripted. Selecting a display model or replaying a task does not
send a model request or execute its displayed commands. Restarting the app restores
the complete scripted transcripts; other conversations are preserved.

## Verified on 2026-09-13

- Android `PJA110`: `com.baimoqilin.aether.showcase`, version 2.1.6 (11),
  14 scripted sessions; the original Aether package remains installed.
- iPad Air (5th generation): `com.baimoqilin.aether`, version 2.1.6 (20),
  12 scripted sessions.
- iPhone 17 Pro Simulator: iOS 26.5, version 2.1.6 (20), 12 scripted sessions.
- All 227 Android Demo unit tests pass. Both catalogs pass turn, tool-detail,
  attachment-byte, image-size, archive-integrity, and PDF checks.
- Simulator checks cover replay, pause, restore-completed, expanded command and
  output, and a full image attachment preview. The iOS completed-state indicator
  and output-attachment visibility were corrected during these checks.
- Original messages were compared before and after installing: 21 on the Android
  showcase package and 70 on the iPad, with identical content hashes.
