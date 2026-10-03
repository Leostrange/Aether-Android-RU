// Offline film fixtures. These commands and results are scripts, never executed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const assets = path.join(here, 'assets');
const output = path.join(root, 'shared/src/commonMain/composeResources/files/showcase');
const fakeKey = 'AQ.AasdhjkwjecwiejdqlksalcdakjwJAFhHZiYVaskwewwLdqTUQ';
const bash = (command, stdout, seconds = 2) => ({ name: 'bash', args: { command, timeout: 120 }, stdout, seconds });
const read = (file, stdout) => ({ name: 'read', args: { path: file, offset: 1, limit: 160 }, stdout, seconds: 1 });
const tool = (name, args, stdout, seconds = 2) => ({ name, args, stdout, seconds });
const websiteTools = [
  bash("ssh -o BatchMode=yes root@baimoqilin.com 'pwd'", '/root'),
  bash("ssh root@baimoqilin.com 'find /opt -maxdepth 2 -name package.json -not -path \"*/node_modules/*\"'", '/opt/baimoqilin.com/package.json'),
  bash("ssh root@baimoqilin.com 'pm2 jlist'", '[{"name":"baimoqilin.com","pm2_env":{"status":"online","pm_cwd":"/opt/baimoqilin.com","exec_mode":"cluster_mode","instances":2}}]'),
  bash("ssh root@baimoqilin.com 'cd /opt/baimoqilin.com && git status --short && cat package.json'", '{"scripts":{"build":"next build","start":"next start","test":"vitest run"},"dependencies":{"next":"15.3.0","react":"19.0.0"}}'),
  bash("ssh root@baimoqilin.com 'cd /opt/baimoqilin.com && rg -n \"projects|项目\" src --glob \"!**/node_modules/**\"'", 'src/app/projects/page.tsx:4:import { projects } from "@/data/projects";\nsrc/data/projects.ts:1:export const projects = ['),
  bash("ssh root@baimoqilin.com 'cd /opt/baimoqilin.com && sed -n \"1,160p\" src/data/projects.ts'", 'export const projects = [\n  { name: "Personal Dashboard", href: "https://github.com/Zhou-Shilin", description: "A personal workspace." },\n  { name: "More projects", href: "/archive", description: "Selected experiments." }\n];'),
  bash("ssh root@baimoqilin.com 'cd /opt/baimoqilin.com && cp src/data/projects.ts /tmp/projects.before-aether.ts'", 'Backup created: /tmp/projects.before-aether.ts'),
  tool('edit', { path: '/opt/baimoqilin.com/src/data/projects.ts', oldText: '{ name: "Personal Dashboard", href: "https://github.com/Zhou-Shilin", description: "A personal workspace." }', newText: '{ name: "Aether", href: "https://github.com/Zhou-Shilin/Aether", description: "把完整的 AI Agent 工作空间带到手机与平板，连接模型、工具与本地运行环境。" }' }, 'Successfully replaced the first project. 1 file changed, 1 insertion(+), 1 deletion(-).'),
];

const specs = [
  {
    key: 'website', title: ['把 Aether 放上项目页', 'Aether on the Projects page'], duration: 222, count: 27,
    prompt: ['连接 ssh root@baimoqilin.com，在 /opt 有个 pm2 管理的网站 baimoqilin.com，你帮我把「项目」页面的第一个项目改成 Aether，链接是 github.com/Zhou-Shilin/Aether，简介你自己写。', 'Connect over SSH to root@baimoqilin.com. There is a PM2-managed website, baimoqilin.com, under /opt. Change the first project on the Projects page to Aether, link it to github.com/Zhou-Shilin/Aether, and write the description yourself.'],
    intro: ['我会先确认 PM2 对应的项目目录和页面数据来源，保留原文件备份，再修改、构建并检查线上页面。', 'I will locate the PM2 application and the project data, save a backup, then update, build, and check the live page.'],
    tools: websiteTools,
    phases: ['Build production assets', 'Check project metadata', 'Reload PM2 workers', 'Verify HTTP response', 'Inspect mobile layout'],
    answer: [
      '已经更新并上线。打开 [baimoqilin.com/projects](https://baimoqilin.com/projects)，第一个项目现在是 **Aether**。\n\n- **项目名称：** Aether\n- **项目链接：** [github.com/Zhou-Shilin/Aether](https://github.com/Zhou-Shilin/Aether)\n- **简介：** 把完整的 AI Agent 工作空间带到手机与平板，连接模型、工具与本地运行环境。\n\n页面继续沿用原来的项目卡片和排序，点击 Aether 会在新标签页打开 GitHub 仓库。中文简介在手机宽度下也能完整换行。\n\n我在 `/opt/baimoqilin.com` 完成了生产构建，随后通过 PM2 滚动重载两个 worker。重载后检查了 HTTPS 页面、项目链接和服务日志：页面返回 200，两个进程均为 online，没有新增启动错误。\n\n修改前的项目数据保存在 `/tmp/projects.before-aether.ts`，可以用来核对这次替换。',
      'The update is live. The first project at [baimoqilin.com/projects](https://baimoqilin.com/projects) is now **Aether**.\n\n- **Name:** Aether\n- **Link:** [github.com/Zhou-Shilin/Aether](https://github.com/Zhou-Shilin/Aether)\n- **Description:** A complete AI agent workspace for your phone and tablet, connecting models, tools, and a local runtime.\n\nThe project keeps the existing card style and position. Its link opens the repository in a new tab, and the description wraps cleanly on narrow screens.\n\nI built the production application in `/opt/baimoqilin.com` and used PM2 to reload both workers. The HTTPS page returns 200, both processes are online, and the startup logs contain no new errors. I also checked that the rendered first card points to the exact repository URL.\n\nThe original project data is preserved at `/tmp/projects.before-aether.ts` for comparison or rollback.',
    ],
  },
  {
    key: 'screenshots', title: ['App Store 英文截图', 'English App Store screenshots'], duration: 378, count: 63, skill: 'app-store-screenshots',
    prompt: ['请帮我生成 App Store Screenshot。使用英语。只需要 iPhone 尺寸的。如果需要我选择等，都可以停下来问我。仓库在 https://github.com/Zhou-Shilin/Aether', 'Please generate App Store screenshots in English, for iPhone only. You can stop and ask me whenever you need a choice or clarification. The repository is https://github.com/Zhou-Shilin/Aether'],
    intro: ['我会使用 app-store-screenshots，先看仓库和你上传的三张参考图，再确定一组适合 iPhone 的英文文案与版式。', 'I will use app-store-screenshots to review the repository and your three reference images, then prepare an English screenshot set for iPhone.'],
    tools: [
      read('/root/.pi/agent/skills/app-store-screenshots/SKILL.md', 'name: app-store-screenshots\nCreate App Store artwork from actual product captures. Confirm platform, locale, dimensions and source assets before exporting PNG files.'),
      bash('git clone --depth 1 https://github.com/Zhou-Shilin/Aether /workspace/Aether', "Cloning into '/workspace/Aether'...\nReceiving objects: 100%"),
      read('/workspace/Aether/README.md', '# Aether\nAn AI agent workspace for Android and iOS. Local runtime, skills, extensions, files, and persistent conversations.'),
      bash('identify /workspace/uploads/reference-{1,2,3}.jpg', 'reference-1.jpg JPEG 1080x2400\nreference-2.jpg JPEG 1080x2400\nreference-3.jpg JPEG 1080x2400'),
      tool('read', { path: '/workspace/uploads/reference-1.jpg' }, 'Image loaded. Aether chat screen with message composer, model selector, and expandable tool execution.'),
      bash('find /workspace/Aether/public -maxdepth 1 -type f', '/workspace/Aether/public/chat.jpg\n/workspace/Aether/public/tool_execution.jpg\n/workspace/Aether/public/agentmode.jpg\n/workspace/Aether/public/aether_mark.png'),
      tool('write', { path: '/workspace/screenshots/copy.json', content: '{"locale":"en-US","size":[1320,2868],"headlines":["Your agent. Anywhere.","From prompt to done.","A workspace that goes with you."]}' }, 'Wrote English copy and iPhone export dimensions.'),
      bash('python /root/.pi/agent/skills/app-store-screenshots/scripts/render.py --copy /workspace/screenshots/copy.json --assets /workspace/Aether/public --output /workspace/screenshots/en-US', 'Rendering 3 iPhone compositions at 1320 x 2868.\nLoaded 3 source captures.\nColor profile: sRGB.\nExport format: opaque PNG.', 12),
    ],
    phases: ['Check English line breaks', 'Render iPhone artwork', 'Inspect safe margins', 'Validate PNG dimensions', 'Package deliverables'],
    answer: [
      '已完成一组 **3 张英文 iPhone App Store 截图**，成品和打包文件都在下面。\n\n这组采用深色文字、清晰的产品实拍和青绿色强调色，三张图分别讲清楚 Aether 是什么、能完成什么工作，以及怎样把工作空间带在身边：\n\n1. **Your agent. Anywhere.** 展示完整聊天界面，让用户第一眼看到 Aether 的核心体验。\n2. **From prompt to done.** 展示工具执行过程和任务产物，突出从请求到完成的工作流。\n3. **A workspace that goes with you.** 展示移动设备上的 Agent Mode 与文件操作。\n\n每张均为 **1320 × 2868 px、PNG、sRGB、无透明通道**，只包含 iPhone 版本。英文标题在同一基线上，产品画面保留了可辨认的真实内容；我也检查了边缘留白、文字溢出和缩略图可读性。\n\n你上传的三个附件按同一参考图处理，没有把重复图片误当成三个不同功能页面。下面可以先看单张成品，再下载完整 ZIP。',
      'The **three English iPhone App Store screenshots** are ready, with individual PNGs and a ZIP attached below.\n\nThe sequence introduces the product, shows useful work happening, and closes with its mobile workspace:\n\n1. **Your agent. Anywhere.** The conversation view introduces Aether through its actual interface.\n2. **From prompt to done.** An expanded tool workflow connects a request to a concrete result.\n3. **A workspace that goes with you.** Agent Mode and files show how work continues on a mobile device.\n\nEach export is **1320 × 2868 px, opaque PNG, in sRGB**. This set contains iPhone artwork only. The headline baseline and product framing are consistent across the set; I checked line breaks, safe margins, and readability at thumbnail size.\n\nI treated your three uploads as repeated copies of one visual reference. The finished compositions use distinct product captures so each screenshot communicates a different part of Aether. Preview the images below, then use the ZIP for the complete set.',
    ],
    inputAssets: ['reference.jpg', 'reference.jpg', 'reference.jpg'], outputAssets: ['01-iphone.png', '02-iphone.png', '03-iphone.png', 'app-store-iphone-en.zip'],
  },
  {
    key: 'research', title: ['OpenAI 与 NS 问题调查', 'OpenAI and Navier-Stokes'], duration: 1361, count: 247,
    prompt: ['调查 OpenAI 近期解决 NS 问题并制作 PDF 报告。', 'Investigate the recent claims that OpenAI solved the Navier-Stokes problem and prepare a PDF report.'],
    intro: ['我先按 Navier–Stokes 方程理解 NS，追溯消息的原始出处，再区分数值实验、特定情形结果和千禧年难题意义上的证明。最后把证据与结论整理成 PDF。', 'I will interpret NS as Navier-Stokes, trace the original sources, and separate numerical results and special cases from a proof of the Millennium Prize Problem. Then I will prepare a PDF evidence review.'],
    tools: [
      tool('web_search', { query: 'OpenAI Navier Stokes solved original paper announcement 2026' }, 'Search completed. Results grouped into primary announcements, preprints, and secondary commentary. A headline alone does not establish a proof.'),
      tool('web_search', { query: 'site:openai.com Navier Stokes mathematics' }, 'Primary-source search complete. Candidate pages saved for full-text review; publication date and update date recorded separately.'),
      bash("curl -L --fail 'https://www.claymath.org/millennium/navier-stokes-equation/' -o /workspace/research/clay-ns.html", 'HTTP 200\nSaved official Millennium Prize Problem statement.'),
      read('/workspace/research/clay-ns.txt', 'The problem concerns existence and smoothness of solutions to the three-dimensional incompressible Navier-Stokes equations, or a valid breakdown example under the stated hypotheses.'),
      tool('web_search', { query: 'Navier Stokes global regularity OpenAI preprint proof independent verification' }, 'Collected candidate claims and expert discussions. Next step: compare hypotheses, dimensions, boundary conditions, and proof status.'),
      bash("curl -L --fail 'https://export.arxiv.org/api/query?search_query=all:navier_stokes&sortBy=submittedDate&sortOrder=descending&max_results=20' -o /workspace/research/arxiv.xml", 'Saved Atom feed: 20 recent entries. Author, title, abstract, identifier, and revision timestamp extracted.'),
      tool('write', { path: '/workspace/research/evidence.csv', content: 'claim,primary_source,scope,independent_review,status\nGlobal 3D regularity,required,all admissible initial data,required,not established\nNumerical benchmark,check experiment,finite resolution,check replication,does not imply a theorem' }, 'Created evidence matrix and explicit proof criteria.'),
      bash('python /workspace/research/extract_sources.py --input /workspace/research --output /workspace/research/source-notes.json', 'Indexed source excerpts with title, URL, date, and scope. Duplicate syndications collapsed; unsupported claims flagged for review.', 8),
    ],
    phases: ['Trace primary source', 'Compare theorem assumptions', 'Read preprint section', 'Cross-check citations', 'Review independent commentary', 'Typeset PDF', 'Check report references'],
    answer: [
      '报告已经整理完成，PDF 附在下面。我的核心结论是：**不能仅凭“OpenAI 解决了 NS”这类表述，认定三维 Navier–Stokes 的存在性与光滑性问题已被解决。**\n\n这次调查把容易混淆的结果分成了三类：\n\n- **数值求解与预测：** 在有限网格、有限时间或特定测试集上取得进展，属于计算方法和实验能力的提升。\n- **受限情形的数学结果：** 二维情形、小初值、特殊对称性或附加假设下的定理，需要明确适用范围。\n- **千禧年难题：** 必须满足官方问题陈述的初始条件和定义，并给出可供独立核验的完整证明或合格反例。\n\n因此，若报道只展示流场模拟、模型辅助推导或某个特例，它并不自动推出一般三维问题的解决。报告中单独列出了每项说法需要什么一手证据，以及哪些环节仍需要独立专家复核。\n\nPDF 包含问题背景、证据分级、常见误读、核验清单和参考来源入口。引用与结论被放在一起，便于从结论追溯依据；未获得充分依据的内容明确标为未证实。\n\n更稳妥的传播表述是：**“AI 在相关流体计算或数学研究中的具体进展，需要与 Navier–Stokes 千禧年难题的正式解决区分。”**',
      'The PDF report is attached. Its central conclusion is that **a claim that OpenAI “solved NS” does not, by itself, establish a solution to the three-dimensional Navier-Stokes existence and smoothness problem.**\n\nThe report distinguishes three kinds of result:\n\n- **Numerical simulation and prediction:** Better performance on a finite grid, time interval, or benchmark is a computational advance.\n- **Restricted mathematical results:** Two-dimensional systems, small-data regimes, symmetry assumptions, or additional hypotheses have narrower scope.\n- **The Millennium Prize Problem:** A solution must satisfy the official statement and provide a complete proof or admissible breakdown example that can be independently checked.\n\nA fluid simulation, an AI-assisted derivation, or a successful special case does not automatically imply a general theorem in three dimensions. I organized the review around the evidence needed for each claim: the original statement, exact hypotheses, full argument, and independent mathematical scrutiny.\n\nThe PDF includes background, an evidence hierarchy, common sources of confusion, verification criteria, and reference entry points. Unsupported statements are marked as unverified, with conclusions placed beside the evidence needed to assess them.\n\nA defensible public description is: **“Specific AI advances in fluid computation or mathematical research should be distinguished from a formally verified solution to the Navier-Stokes Millennium Prize Problem.”**',
    ], outputAssets: ['ns-report-{lang}.pdf'],
  },
  {
    key: 'readest', androidOnly: true, title: ['修复 Readest 书籍', 'Repair a Readest book'], duration: 446, count: 41,
    prompt: ['我的手机上安装了 Readest 软件，其中的一本书出现了文件损坏。请利用 root 权限直接修复文件。', 'Readest is installed on my phone, and one of its books has a corrupted file. Please use root access to repair the file directly.'],
    intro: ['我会先定位 Readest 的书库和损坏文件，备份原件及相关记录，再检查容器结构。修复后会保留阅读进度并验证文件能正常打开。', 'I will locate Readest’s library and the damaged file, back up the original and its records, then inspect the container. After repair, I will check that the book opens and its reading position is preserved.'],
    tools: [
      bash('su -c id', 'uid=0(root) gid=0(root) groups=0(root) context=u:r:magisk:s0'),
      bash("pm list packages | grep -i readest", 'package:com.readest.readest'),
      bash("su -c 'dumpsys package com.readest.readest'", 'Package [com.readest.readest]\n  dataDir=/data/user/0/com.readest.readest\n  userId=10342'),
      bash("su -c 'find /data/user/0/com.readest.readest/files -maxdepth 4 -type f -name \"*.epub\"'", '/data/user/0/com.readest.readest/files/books/8fa21/The-Art-of-War.epub'),
      bash("su -c 'stat /data/user/0/com.readest.readest/files/books/8fa21/The-Art-of-War.epub'", 'Size: 284391\nUid: (10342) Gid: (10342)\nAccess: (0600/-rw-------)'),
      bash("su -c 'cp -a /data/user/0/com.readest.readest/files/books/8fa21 /data/user/0/com.readest.readest/files/books/8fa21.backup'", 'Backup completed. Book content, sidecar metadata, and ownership preserved.'),
      bash("su -c 'unzip -t /data/user/0/com.readest.readest/files/books/8fa21/The-Art-of-War.epub'", 'error: End-of-central-directory signature not found.\nLocal file records detected; recovery may be possible.'),
      bash("su -c 'zip -FF /data/user/0/com.readest.readest/files/books/8fa21/The-Art-of-War.epub --out /data/local/tmp/readest-repaired.epub'", 'Fix archive: recover local entries\nRecovered: mimetype, META-INF/container.xml, content.opf, nav.xhtml, 13 chapter files, stylesheet.css\nRecovered 18 entries.', 11),
    ], phases: ['Validate EPUB container', 'Check chapter CRC', 'Preserve ownership', 'Restore library metadata', 'Verify reading position'],
    answer: [
      '已经修复。损坏的是 Readest 书库中的 **《孙子兵法》EPUB 文件**，问题出在 ZIP 容器末尾的目录记录，章节正文仍可恢复。\n\n我先完整备份了原书和旁边的阅读记录，再从现存的文件条目重建容器，校验全部章节与资源，并检查了 `container.xml`、OPF 清单和阅读顺序。恢复后的 13 个章节均能读取，校验没有发现 CRC 错误。\n\n替换回书库时保留了原来的应用 UID/GID、访问权限和文件名，所以 Readest 继续把它识别为原来那本书。书架条目、书签和上次阅读位置均已保留；重新打开后，可以从原来的位置继续阅读。\n\n**备份位置：** `/data/user/0/com.readest.readest/files/books/8fa21.backup`\n\n这是对本地容器的修复，没有重新下载另一版书，也没有清空 Readest 的数据。建议先翻阅几章确认内容，确认无误后再处理备份。修复记录附在下面，包含恢复条目和校验结果。',
      'The book is repaired. The affected file was **The Art of War** in Readest’s EPUB library. Its ZIP central-directory record was damaged, while the chapter data remained recoverable.\n\nI backed up the original book and its sidecar reading records, rebuilt the archive from its surviving local entries, and checked the chapters and resources. The container descriptor, OPF manifest, and spine are consistent; all 13 chapters can be read, and the recovered entries pass CRC verification.\n\nWhen replacing the file, I preserved the original application UID/GID, permissions, filename, and library identity. Readest therefore continues to recognize it as the same book. Its shelf entry, bookmarks, and last reading position were retained, and the book opens at that position.\n\n**Backup:** `/data/user/0/com.readest.readest/files/books/8fa21.backup`\n\nThis repaired the local container without substituting a different edition or clearing Readest’s application data. The attached repair log lists the recovered entries and validation results. Browse a few chapters before removing the backup.',
    ], outputAssets: ['readest-repair.txt'],
  },
  {
    key: 'book', title: ['儒林外史逐章总结', 'The Scholars, chapter by chapter'], duration: 832, count: 132,
    prompt: [`用 key ${fakeKey} 并行调用 Gemini 3.8 Flash 模型，每章一个请求来总结，然后把所有总结拼在一起。`, `Use the key ${fakeKey} to call Gemini 3.8 Flash in parallel, with one request per chapter to summarize it, then combine all the summaries.`],
    intro: ['我先识别附件的编码和章回边界，再按章生成独立请求，用有上限的并发处理。合并时按原书顺序排列，并核对漏章、重复和失败请求。', 'I will check the attachment’s encoding and chapter boundaries, then send one request per chapter with bounded concurrency. The merged document will follow the original order, with checks for missing, duplicate, or failed chapters.'],
    tools: [
      bash('file -bi /workspace/uploads/儒林外史.txt', 'text/plain; charset=utf-8'),
      bash("python -c \"from pathlib import Path; t=Path('/workspace/uploads/儒林外史.txt').read_text(); print(len(t)); print(t[:240])\"", 'UTF-8 text loaded\n儒林外史\n吴敬梓\n第一回 说楔子敷陈大义 借名流隐括全文'),
      bash("rg -n '^第[一二三四五六七八九十百零〇]+回' /workspace/uploads/儒林外史.txt", 'Matched 56 chapter headings, 第一回 through 第五十六回. No duplicated chapter number.'),
      tool('write', { path: '/workspace/summarize/split.py', content: 'import re\nfrom pathlib import Path\ntext = Path("/workspace/uploads/儒林外史.txt").read_text(encoding="utf-8-sig")\nparts = re.split(r"(?m)^(?=第[一二三四五六七八九十百零〇]+回\\s)", text)\nchapters = [p for p in parts if re.match(r"^第.+?回", p)]\nassert len(chapters) == 56\nfor i, chapter in enumerate(chapters, 1):\n    Path(f"chapters/{i:02}.txt").write_text(chapter, encoding="utf-8")' }, 'Saved splitter with chapter-count validation.'),
      bash('cd /workspace/summarize && python split.py', '56 chapter files created. Chapter headings preserved. No empty chapter body.'),
      tool('write', { path: '/workspace/summarize/config.json', content: '{"model":"gemini-3.8-flash","concurrency":8,"temperature":0.2,"retry":{"maxAttempts":3,"backoffSeconds":[2,5,12]},"output":"results/{chapter}.json"}' }, 'Saved request configuration. API key supplied through the process environment, excluded from output artifacts.'),
      tool('bash', { command: 'cd /workspace/summarize && python summarize.py --chapter 01 --validate-only', timeout: 120 }, 'Chapter 01 payload validated: model=gemini-3.8-flash; schema=chapter,title,characters,events,themes; non-empty text; output path unique.'),
      bash('cd /workspace/summarize && python summarize.py --all --concurrency 8 --resume', 'Queued 56 chapters. Active requests: 8.\n[01/56] Chapter 01 complete\n[02/56] Chapter 02 complete\nCheckpoints saved after each response.', 19),
    ], phases: ['Summarize chapter', 'Validate chapter response', 'Write checkpoint', 'Merge in original order', 'Check complete chapter set'],
    answer: [
      '已完成，附件中的 **56 回已逐章总结并合并**。每章使用独立请求，最多同时运行 8 个；合并结果按第一回到第五十六回排列，没有按请求返回的先后顺序打乱章节。\n\n每回统一保留四部分内容：主要人物、情节梗概、关键转折和讽刺主题。总结尽量说明人物之间的关系和事件的因果，而不是只罗列名字。全书开篇王冕的独立人格，与周进、范进的科举经历，以及后续士林交游、礼仪和道德表演之间的联系，也在总览中串联起来。\n\n**交付文件：**\n\n- Markdown 完整版：带章回标题和目录，便于继续编辑。\n- 纯文本版：适合在阅读器或笔记软件中打开。\n- 执行清单：记录每回的状态、请求次数和输出文件，便于单章重跑。\n\n核对结果为 **56/56 成功、0 回遗漏、0 回重复**。中途两个限流响应已按退避策略重试，最终均完成。API key 没有写进交付文件、日志或总结正文。\n\n附件是情节与主题总结，不替代原文；对人物评价，我保留了小说的讽刺语境，避免把叙述中的反讽直接当成作者赞许。',
      'All **56 chapters have been summarized individually and merged**. Each chapter used its own request, with up to eight requests active at once. The combined document follows the book’s chapter order rather than the order in which responses arrived.\n\nEach chapter includes the principal characters, a plot summary, the important turning point, and the satirical theme. The summaries explain relationships and consequences, rather than simply listing names. The opening portrait of Wang Mian is connected in the overview to Zhou Jin, Fan Jin, examination culture, scholarly society, and the novel’s treatment of performed virtue.\n\n**Deliverables:**\n\n- A complete Markdown document with chapter headings and a contents section.\n- A plain-text edition for reading and note-taking applications.\n- A request manifest with per-chapter status and attempt counts for selective reruns.\n\nValidation finished at **56/56 successful, zero missing chapters, and zero duplicates**. Two rate-limited responses completed after backoff and retry. The API key is absent from the deliverables, logs, and summary text.\n\nThese are plot and theme summaries, not a replacement for the novel. Interpretations preserve its satirical context, especially where apparently approving narration is ironic.',
    ], inputAssets: ['儒林外史.txt'], outputAssets: ['scholars-summary-{lang}.md', 'scholars-summary-{lang}.txt', 'chapter-manifest.json'],
  },
  {
    key: 'extension', title: ['为回复添加翻译按钮', 'A translation button for replies'], duration: 487, count: 76, skill: 'Create Extension',
    prompt: ['创建一个 Aether Extension，在每次 Agent 回复下面添加翻译按钮。', 'Create an Aether Extension that adds a translation button below every Agent reply.'],
    intro: ['我会使用 Create Extension，先确认回复动作区域的扩展接口，再实现翻译、加载状态和结果缓存。按钮会跟随每条回复，译文显示在原文下面。', 'I will use Create Extension to inspect the reply-action API, then implement translation, loading states, and caching. Each reply will have its own button, with the translation displayed below the original.'],
    tools: [
      read('/root/.pi/agent/skills/create-extension/SKILL.md', 'Create an Aether extension using the documented extension SDK. Inspect the supported UI surfaces and event APIs before registering components.'),
      bash('ls /workspace/Aether/extensions', 'README.md\naether-browser\naether-core\npi-subagents'),
      bash('rg -n "message.actions|assistant|translation" /workspace/Aether/docs/extensions /workspace/Aether/packages --glob "!**/node_modules/**"', 'Found reply-action extension surface and host service documentation. UI actions can dispatch extension events with a message identifier.'),
      read('/workspace/Aether/extensions/README.md', 'Extensions register UI contributions, settings, and event handlers. The host owns message identity and renders the same component tree on Android and iOS.'),
      tool('write', { path: '/workspace/aether-translate/package.json', content: '{"name":"aether-translate","version":"0.1.0","private":true,"description":"Translate assistant replies inline","pi":{"extensions":["./index.ts"]}}' }, 'Created extension package manifest.'),
      tool('write', { path: '/workspace/aether-translate/translation-state.ts', content: 'export type TranslationState = { status: "idle" | "loading" | "ready" | "error"; text?: string; error?: string };\nexport const translations = new Map<string, TranslationState>();\nexport const cacheKey = (messageId: string, language: string, revision: string) => `${messageId}:${language}:${revision}`;' }, 'Created per-message state and language-aware cache keys.'),
      tool('write', { path: '/workspace/aether-translate/README.md', content: '# Reply Translator\nAdds a Translate action to assistant replies. Default target: app language. Supports loading, cancellation, retry, cached results, and original-text preservation. Code blocks are preserved verbatim.' }, 'Saved installation and behavior notes.'),
      bash('cd /workspace/aether-translate && npm run typecheck', '> tsc --noEmit\nNo type errors.', 7),
    ], phases: ['Register reply action', 'Implement translation event', 'Check language settings', 'Test cache invalidation', 'Verify Android and iOS UI', 'Package extension'],
    answer: [
      '**Reply Translator 扩展已完成**，安装包和说明文件附在下面。它会在每条 Agent 回复下方添加一个翻译按钮，点击后在该条回复下面显示译文，原文保持可见。\n\n交互行为已经补齐：\n\n- 默认翻译到应用当前语言，也可以在扩展设置里固定为中文或英语。\n- 请求期间按钮显示加载状态，重复点击不会创建重复请求。\n- 完成后可以收起、重新展开或复制译文。\n- 请求失败会显示重试入口，不会影响原回复和其他消息。\n- 同一条回复、相同目标语言会复用缓存；切换语言或修改消息后会重新翻译。\n\nMarkdown 的标题、列表和链接会保留，代码块保持原样，避免翻译代码导致示例失效。缓存以会话和消息 ID 隔离，切换 Session 时不会把译文贴到另一条回复上。\n\n我检查了 Android 与 iOS 的同一扩展 UI 入口，并覆盖了成功、失败、取消、切换语言和历史回复的情况。下面的 ZIP 可从 Aether 的 Extensions 页面导入，启用后已有回复也会出现按钮。',
      '**Reply Translator is ready.** The extension package and documentation are attached. It adds a translation button below each Agent reply and displays the translation inline while keeping the original visible.\n\nThe interaction includes the expected states:\n\n- The target defaults to the app language, with Chinese and English overrides in extension settings.\n- A loading state prevents duplicate requests for the same reply.\n- Finished translations can be collapsed, reopened, and copied.\n- Failures expose a retry action without changing the original response.\n- Repeated requests reuse the cache; changing the language or message revision invalidates it.\n\nHeadings, lists, and links retain their Markdown structure. Code blocks stay unchanged so translation does not break executable examples. Cache entries include the session and message identity, preventing results from appearing beneath the wrong reply after switching conversations.\n\nThe shared extension surface was checked on Android and iOS, including success, failure, cancellation, language changes, and historical replies. Import the ZIP from Aether’s Extensions page and enable it; existing Agent replies will receive the action as well.',
    ], outputAssets: ['reply-translator.zip', 'reply-translator-README.md'],
  },
  {
    key: 'agentmode', title: ['排查 Agent Mode 配置', 'Diagnose Agent Mode setup'], duration: 94, count: 16,
    prompt: ['我的 Agent Mode 好像没配置成功，出了什么问题？', 'My Agent Mode does not seem to be configured correctly. What went wrong?'],
    intro: ['我会检查运行环境、授权方式和 Agent Mode 服务状态，把安装完成与实际可用这两件事分别验证。', 'I will check the runtime, authorization method, and Agent Mode service, and verify that the installed components are actually usable.'],
    tools: [
      tool('aether_settings', { action: 'get', keys: ['defaultRuntimeId', 'agentModeAuthorizationEnabled', 'agentModeAuthorizationMethod'] }, '{"defaultRuntimeId":"alpine","agentModeAuthorizationEnabled":true,"agentModeAuthorizationMethod":"root"}'),
      tool('aether_runtime', { action: 'status' }, '{"alpine":{"installed":true,"ready":true},"node":{"ready":true},"piBridge":{"ready":true}}'),
      bash('node --version', 'v22.14.0'),
      bash('command -v python3', '/usr/bin/python3'),
      tool('aether_agent_mode', { action: 'status' }, '{"configured":true,"authorization":"denied","serviceConnected":false,"lastError":"Root authorization was not granted"}'),
      bash('su -c id', 'su: permission denied. The superuser manager has not granted access to Aether.'),
      tool('aether_diagnostics', { category: 'agent_mode', limit: 30 }, 'Last setup: runtime ready; root request rejected; service handshake skipped. No model authentication error recorded.'),
      tool('aether_settings', { action: 'get', keys: ['agentModeAuthorizationMethod', 'alpineSetupCompleted'] }, '{"agentModeAuthorizationMethod":"root","alpineSetupCompleted":true}'),
    ], phases: ['Check authorization state', 'Compare setup and service status', 'Validate remediation steps'],
    answer: [
      '原因找到了：**运行环境已经装好，但 Agent Mode 的 root 授权没有通过。** 因此设置里有配置记录，实际控制服务却没有建立连接。\n\n当前状态是：\n\n| 检查项 | 结果 |\n| --- | --- |\n| Alpine / Node / Pi Bridge | 正常 |\n| Agent Mode 授权方式 | root |\n| root 调用 | Permission denied |\n| 控制服务连接 | 未连接 |\n\n这不是模型 API key 的问题，也不需要重装 Alpine。需要到手机的超级用户管理器中找到 Aether，把授权改为允许，再回到 **Settings → Agent Mode** 重新检查连接。授权弹窗出现时，选择持续允许，避免每次启动都被拦截。\n\n恢复后应同时看到“授权成功”和“服务已连接”。只看到安装完成还不够。现有 Session、文件和模型配置都可以保留。若授权已经允许但仍失败，再检查是否授给了另一个包名的 Aether，以及系统是否限制了后台服务。',
      'I found the cause: **the runtime is installed, but root authorization for Agent Mode was denied.** The configuration exists, while the control service has never completed its connection.\n\n| Check | Result |\n| --- | --- |\n| Alpine, Node, and Pi Bridge | Ready |\n| Selected authorization method | Root |\n| Root command | Permission denied |\n| Control service | Disconnected |\n\nThis is not a model API-key failure, and reinstalling Alpine is unnecessary. Open the phone’s superuser manager, find Aether, allow root access, and return to **Settings → Agent Mode** to reconnect. When prompted, allow persistent access so the next launch is not blocked again.\n\nA successful setup should show both authorized access and a connected service. An “installed” runtime alone does not confirm that device control is ready. Your sessions, files, and model settings can stay as they are. If the authorization is already allowed, check that it belongs to the correct Aether package and that background service restrictions are not stopping the connection.',
    ],
  },
];

const followups = [
  { prompt: ['简介稍微短一点，强调开源和移动端。', 'Shorten the description and emphasize open source and mobile.'], answer: ['已改成：**开源的移动端 AI Agent 工作空间。**\n\n这句话保留了产品类型、开源属性和移动端定位，项目列表在手机上更容易扫描。英文版本同步为 **An open-source AI agent workspace for mobile.**\n\n我更新了项目数据并重新构建、重载服务，检查了中文和英文页面中的第一张卡片。两种语言都没有溢出，GitHub 链接仍然正确。', 'The description now reads: **An open-source AI agent workspace for mobile.**\n\nThe Chinese version is **开源的移动端 AI Agent 工作空间。** Both keep the product category, open-source identity, and mobile focus in a compact line.\n\nI rebuilt and reloaded the site, then checked both language versions of the first card. The text fits cleanly and the GitHub destination is correct.'], duration: 74, count: 12, file: 'src/data/projects.ts', change: 'Shorten Aether description in both locales' },
  { prompt: ['给 Aether 项目加个图标，就用仓库里的。', 'Add an icon to the Aether project using the one in the repository.'], answer: ['已换上仓库中的 Aether 图标。图标放在项目名称左侧，与其他项目的视觉大小一致；透明边缘和宽高比都保留了。\n\n我把图片复制到网站自己的静态资源目录，页面不依赖 GitHub 的图片加载速度。图标带有 Aether 的替代文本，深浅背景下都检查过，点击卡片仍能正常打开仓库。', 'The card now uses the Aether icon from the repository, aligned beside its name and sized consistently with the other projects. Its proportions and transparent edges are preserved.\n\nThe asset is served from the website’s own static directory, avoiding a dependency on GitHub image loading. I checked contrast, alternative text, and the card link after rebuilding.'], duration: 111, count: 18, file: 'src/components/ProjectCard.tsx', change: 'Render locally hosted Aether icon with alt text' },
  { prompt: ['手机上图标有点大，缩小一点，文字对齐。', 'The icon is a little large on mobile. Make it smaller and align the text.'], answer: ['已把手机布局中的图标缩到 **32 px**，名称和简介按同一条左侧基线排列。桌面端继续使用 40 px，避免在大屏上显得过小。\n\n我检查了 360、390 和 430 px 三种宽度，长简介能自然换行，图标不会把文字挤出卡片，点击区域也保持完整。新的样式已上线。', 'The mobile icon is now **32 px**, with the name and description sharing a consistent left edge. Desktop keeps the 40 px size.\n\nI checked 360, 390, and 430 px layouts. Descriptions wrap naturally, the icon does not squeeze text outside the card, and the full interaction area remains available. The updated style is live.'], duration: 128, count: 23, file: 'src/components/ProjectCard.tsx', change: 'Use responsive 32px / 40px icon dimensions and aligned text' },
  { prompt: ['再加一个“查看源码”按钮，点击后新开标签页。', 'Add a “View source” button that opens in a new tab.'], answer: ['已添加 **查看源码 / View source**，指向 Aether 的 GitHub 仓库并在新标签页打开。按钮带外链图标，键盘焦点状态也补齐了。\n\n链接使用 `target="_blank"` 和 `rel="noopener noreferrer"`。我同时检查了卡片和按钮的点击逻辑，避免嵌套链接造成重复触发；手机上按钮可以独立点击，不会遮住简介。', 'The card now includes **View source / 查看源码**, opening the Aether repository in a new tab. It has an external-link icon and a visible keyboard focus state.\n\nThe link uses `target="_blank"` with `rel="noopener noreferrer"`. I checked the card’s interaction structure to avoid nested links or duplicate navigation, and confirmed the action stays clear of the description on mobile.'], duration: 96, count: 17, file: 'src/components/ProjectCard.tsx', change: 'Add accessible external source link' },
  { prompt: ['项目页标题下面加一句：我做的一些有趣的东西。英文也处理一下。', 'Below the Projects title, add “Some interesting things I have built.” Update both languages.'], answer: ['已在“项目”标题下加上：**我做的一些有趣的东西。**\n\n英文对应为 **A few things I’ve enjoyed building.** 语气保持个人网站的自然表达。副标题使用正文大小和次级文字颜色，不会压过页面标题或第一张项目卡。\n\n两种语言页面都已构建并检查，移动端换行后的上下间距一致，Aether 仍是列表里的第一个项目。', 'The subtitle is in place. Chinese reads **我做的一些有趣的东西。** and English reads **A few things I’ve enjoyed building.**\n\nIt uses the page’s secondary text style and body-sized type, keeping the heading and first project prominent. Both locales build successfully, mobile spacing remains consistent after wrapping, and Aether stays first in the list.'], duration: 67, count: 11, file: 'src/app/projects/page.tsx', change: 'Add localized Projects subtitle' },
  { prompt: ['检查一下深色模式，还有 iPad 横屏。', 'Check dark mode and landscape layout on iPad.'], answer: ['已完成检查，并修正了深色模式中按钮边框对比不足的问题。图标、简介和外链按钮现在都能在深浅背景下清楚辨认。\n\n我还检查了 iPad 横屏的 1180 × 820 视口：项目网格保持两列，卡片高度协调，标题和副标题不会与列表重叠。手机与桌面回归检查也通过。\n\n这次只调整了边框色和响应式间距；截图记录了两种主题及 iPad 横屏状态，便于你挑宣传片镜头。', 'The checks are complete. I corrected a low-contrast button border in dark mode; the icon, description, and source action are now clear on both backgrounds.\n\nAt the iPad landscape viewport of 1180 × 820, the project grid keeps two columns, card heights remain balanced, and the heading does not overlap the list. Mobile and desktop regression checks also passed.\n\nThe changes are limited to border color and responsive spacing. The captures include both themes and the iPad landscape layout for selecting a filming shot.'], duration: 214, count: 38, file: 'src/components/ProjectCard.tsx', change: 'Improve dark border contrast and tablet spacing' },
  { prompt: ['可以了，最后检查一下线上状态，给我个修改总结。', 'That looks good. Check the live status one last time and summarize the changes.'], answer: ['线上检查完成，网站运行正常。\n\n**本次修改：**\n\n- Aether 成为项目页第一个项目，链接到正确的 GitHub 仓库。\n- 中英文简介突出“开源、移动端、AI Agent 工作空间”。\n- 使用本地托管的 Aether 图标，并优化了手机上的图文对齐。\n- 新增“查看源码”外链按钮，支持键盘操作和新标签页。\n- 项目页加入了双语副标题，修正了深色模式与 iPad 横屏间距。\n\n最终生产构建通过，PM2 两个 worker 均为 online，HTTPS 返回 200。中文、英文、深浅主题和手机/iPad 布局均完成复查。原始项目数据备份仍保留，所有修改可以按文件核对。\n\n现在可以直接打开 [项目页](https://baimoqilin.com/projects) 录制。', 'The final live check passed.\n\n**Changes delivered:**\n\n- Aether is the first project and links to the correct GitHub repository.\n- Both descriptions emphasize an open-source mobile AI agent workspace.\n- The locally served Aether icon has responsive sizing and aligned text.\n- A keyboard-accessible source link opens in a new tab.\n- The page has a bilingual subtitle, with dark-mode contrast and iPad spacing corrected.\n\nThe production build passed, both PM2 workers are online, and HTTPS returns 200. I rechecked both languages, both themes, and phone and iPad layouts. The original project-data backup is retained for comparison.\n\nThe [Projects page](https://baimoqilin.com/projects) is ready for recording.'], duration: 132, count: 24, file: 'src/app/projects/page.tsx', change: 'Final production verification' },
];

function attachment(name, id) {
  const bytes = fs.readFileSync(path.join(assets, name));
  const mimeType = ({ '.jpg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf', '.zip': 'application/zip', '.json': 'application/json', '.md': 'text/markdown' })[path.extname(name)] || 'text/plain';
  return { id, name, mimeType, workspacePath: `/workspace/showcase/${name}`, sizeBytes: bytes.length, inlineBase64: bytes.toString('base64') };
}

function makeTurn(spec, lang, id, turn, start) {
  const language = lang === 'zh' ? 0 : 1;
  const group = `${id}-turn-${turn}`;
  const duration = spec.duration * 1000;
  const calls = Array.from({ length: spec.count }, (_, i) => {
    const sample = spec.tools[i] || bash(`python /workspace/.checks/verify_step.py --task ${spec.key} --step ${i + 1}`, `${spec.phases[i % spec.phases.length]}: completed.`, 1 + i % 7);
    const started = start + 4000 + Math.floor(i * (duration - 19000) / spec.count);
    return { id: `${group}-tool-${i + 1}`, name: sample.name, summary: sample.name === 'bash' ? sample.args.command : `${sample.name} ${sample.args.path || sample.args.query || ''}`, argumentsJson: JSON.stringify(sample.args, null, 2), output: sample.stdout, outputJson: JSON.stringify({ stdout: sample.stdout, stderr: '', exit_code: 0 }), isRunning: false, startedAtMillis: started, completedAtMillis: started + sample.seconds * 1000, startedAtUptimeMillis: started, completedAtUptimeMillis: started + sample.seconds * 1000, timelineOrder: i + 1 };
  });
  const skillPayload = spec.skill ? JSON.stringify({ showcaseSkill: spec.skill }) : '';
  const user = { id: `${group}-user`, text: spec.prompt[language], fromUser: true, createdAtMillis: start - 1000, providerPayloadJson: skillPayload, attachments: (spec.inputAssets || []).map((n, i) => attachment(n, `${group}-upload-${i}`)) };
  const assistant = { id: `${group}-assistant`, text: spec.answer[language], fromUser: false, createdAtMillis: start, completedAtMillis: start + duration, responseDurationMillis: duration, thoughtDurationMillis: 6000 + spec.count * 210, firstTokenLatencyMillis: 1800, modelId: 'gpt-6-astra', providerId: 'openai', responseGroupId: group, tokenUsageSource: 'estimated', usage: { inputTokens: spec.count * 640, outputTokens: spec.count * 91 + 640, totalTokens: spec.count * 731 + 640, requestCount: spec.count + 1, reasoningTokens: spec.count * 36, cachedInputTokens: spec.count * 270 }, responseBlocks: [
    { id: `${group}-intro`, type: 'Text', text: spec.intro[language] },
    { id: `${group}-tools`, type: 'ToolGroup', tools: calls },
    { id: `${group}-final`, type: 'Text', text: spec.answer[language] },
  ], attachments: (spec.outputAssets || []).map((n, i) => attachment(n.replace('{lang}', lang), `${group}-output-${i}`)) };
  return [user, assistant];
}

const sessions = [];
for (const lang of ['zh', 'en']) for (const [index, spec] of specs.entries()) {
  const id = `showcase-v1-${spec.key}-${lang}`;
  let start = Date.UTC(2026, 8, 13, 1, 0) - index * 3600000 - (lang === 'en' ? 86400000 : 0);
  const messages = makeTurn(spec, lang, id, 0, start);
  if (spec.key === 'website') for (const [i, followup] of followups.entries()) {
    start += 600000;
    const ftools = [
      bash("ssh root@baimoqilin.com 'cd /opt/baimoqilin.com && git diff --stat'", 'Working changes confined to Projects page and its assets.'),
      bash(`ssh root@baimoqilin.com 'cd /opt/baimoqilin.com && sed -n "1,120p" ${followup.file}'`, `Current file loaded: ${followup.file}`),
      tool('edit', { path: `/opt/baimoqilin.com/${followup.file}`, description: followup.change }, `Applied: ${followup.change}`),
      bash("ssh root@baimoqilin.com 'cd /opt/baimoqilin.com && npm run build'", 'Compiled successfully. Static pages generated. Exit code 0.', 19),
      bash("ssh root@baimoqilin.com 'cd /opt/baimoqilin.com && npm test -- --run'", 'Tests passed. Projects and locale assertions succeeded.', 4),
      bash("ssh root@baimoqilin.com 'pm2 reload baimoqilin.com --update-env'", '[PM2] Process successfully reloaded. Workers: 2 online.', 3),
      bash('curl -I https://baimoqilin.com/projects', 'HTTP/2 200\ncontent-type: text/html; charset=utf-8'),
      bash("ssh root@baimoqilin.com 'pm2 logs baimoqilin.com --nostream --lines 12'", 'Ready. No new errors after reload.'),
    ];
    messages.push(...makeTurn({ ...followup, key: 'website', intro: ['我会沿用现有页面结构完成这项调整，再检查构建和线上效果。', 'I will apply this adjustment to the existing page, then check the build and live result.'], tools: ftools, phases: ['Check responsive layout', 'Verify localized copy', 'Inspect live page'] }, lang, id, i + 1, start));
  }
  sessions.push({ id, title: spec.title[lang === 'zh' ? 0 : 1], preview: spec.answer[lang === 'zh' ? 0 : 1].split('\n')[0], hasCustomTitle: true, selectedModelKey: 'showcase-openai::gpt-6-astra', messages });
}
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'catalog.json'), JSON.stringify(sessions));
const iosSessions = structuredClone(sessions.filter(s => !s.id.includes('-readest-')));
for (const session of iosSessions.filter(s => s.id.includes('-agentmode-'))) {
  const zh = session.id.endsWith('-zh');
  const response = session.messages[1];
  const answer = zh
    ? '定位到了：**Alpine 已安装，但 Pi Bridge 的启动握手没有完成。** 所以界面保留着配置记录，Agent 实际还没有可用的工具通道。\n\n我检查了运行环境状态、Node 路径和最近一次启动记录。文件系统可读，Node 可执行；失败发生在 Bridge 启动后等待 ready 的阶段，日志记录了旧进程占用连接的情况。\n\n建议回到 Settings 中的本地运行环境页面，停止并重新启动运行环境，然后重新检查 Pi Core。成功后应同时看到运行环境就绪和 Bridge 已连接。现有聊天、附件和模型配置都可以保留，无需重装应用。\n\niOS 的应用沙箱不提供 Android 式的 root 或 Shizuku 全设备控制。这里的修复目标是恢复 Aether 自己的本地工具执行能力。若重启后仍未连接，可以导出最近一次启动日志继续定位。'
    : 'I found the issue: **Alpine is installed, but the Pi Bridge startup handshake did not finish.** The saved configuration exists, while the Agent has no ready tool channel.\n\nThe filesystem is readable and Node runs successfully. The failure occurs while waiting for the Bridge ready event; the latest startup log indicates that an older process retained the connection.\n\nOpen the local runtime page in Settings, stop and restart the runtime, and check Pi Core again. A successful result should show both a ready runtime and a connected Bridge. Your chats, attachments, and model configuration can stay in place.\n\niOS does not provide Android-style root or Shizuku control of the whole device. The goal here is to restore Aether’s own local tool execution. If a restart does not reconnect the Bridge, export the latest startup log for a more precise diagnosis.';
  response.text = answer;
  response.responseBlocks[2].text = answer;
  const diagnostics = [
    tool('aether_settings', {action:'get',keys:['defaultRuntimeId','alpineSetupCompleted']}, '{"defaultRuntimeId":"alpine","alpineSetupCompleted":true}'),
    tool('aether_runtime', {action:'status'}, '{"alpine":{"installed":true,"ready":true},"piBridge":{"ready":false}}'),
    bash('node --version','v22.14.0'),
    bash('command -v python3','/usr/bin/python3'),
    tool('aether_runtime', {action:'bridge_status'}, '{"phase":"waiting_for_ready","connected":false}'),
    bash('ps -eo pid,args', 'PID COMMAND\n28 node /opt/aether/bridge.mjs\n41 node /opt/aether/bridge.mjs'),
    tool('aether_diagnostics',{category:'pi_bridge',limit:30},'Handshake timeout. Previous bridge process still owns connection.'),
    bash('test -r /opt/aether/bridge.mjs && test -w /workspace && echo ready','ready'),
  ];
  response.responseBlocks[1].tools.slice(0,8).forEach((t,i)=>{
    const d=diagnostics[i]; t.name=d.name; t.summary=d.args.command || d.name; t.argumentsJson=JSON.stringify(d.args,null,2); t.output=d.stdout; t.outputJson=JSON.stringify({stdout:d.stdout,stderr:'',exit_code:0});
  });
}
fs.writeFileSync(path.join(output, 'catalog-ios.json'), JSON.stringify(iosSessions));
const manifest = specs.map(s => ({ task: s.key, model: 'GPT-6 Astra Light', seconds: s.duration, toolCalls: s.count, androidOnly: !!s.androidOnly }));
fs.writeFileSync(path.join(here, 'estimates.json'), JSON.stringify({ provenance: 'Fictional offline film fixtures, not measured model benchmarks or executed tasks.', tasks: manifest, websiteFollowups: followups.map(f => ({ seconds: f.duration, toolCalls: f.count })) }, null, 2) + '\n');
console.log(`Generated ${sessions.length} bilingual sessions; website has ${sessions[0].messages.filter(m => m.fromUser).length} user turns.`);
