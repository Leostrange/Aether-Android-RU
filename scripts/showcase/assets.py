"""Generate offline film props from existing Aether captures and public-domain text."""
from pathlib import Path
import json
import re
import shutil
import zipfile
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import simpleSplit

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = HERE / "assets"
OUT.mkdir(exist_ok=True)
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

shutil.copyfile(ROOT / "public/chat.jpg", OUT / "reference.jpg")
for i, (source, headline, subtitle) in enumerate([
    ("chat.jpg", "Your agent.\nAnywhere.", "Aether brings your AI workspace to iPhone."),
    ("tool_execution.jpg", "From prompt\nto done.", "See the work. Open every step."),
    ("agentmode.jpg", "A workspace\nthat goes with you.", "Models, tools, and files. Together."),
], 1):
    im = Image.new("RGB", (1320, 2868), "#F5F7F8")
    draw = ImageDraw.Draw(im)
    mark = Image.open(ROOT / "public/aether_mark.png").convert("RGBA")
    mark.thumbnail((76, 76))
    im.paste(mark, (92, 105), mark)
    draw.text((188, 112), "Aether", font=ImageFont.truetype(BOLD, 57), fill="#152729")
    y = 287
    for line in headline.splitlines():
        draw.text((92, y), line, font=ImageFont.truetype(BOLD, 97 if i == 3 else 111), fill="#123638")
        y += 130
    draw.text((96, y + 48), subtitle, font=ImageFont.truetype(FONT, 39), fill="#466267")
    screenshot = Image.open(ROOT / "public" / source).convert("RGB")
    screenshot.thumbnail((1104, 1920))
    x = (1320 - screenshot.width) // 2
    y = 825 + (1920 - screenshot.height) // 2
    draw.rounded_rectangle((x - 15, y - 15, x + screenshot.width + 15, y + screenshot.height + 15), radius=38, fill="#193C3D")
    im.paste(screenshot, (x, y))
    im.save(OUT / f"{i:02}-iphone.png", optimize=True)
with zipfile.ZipFile(OUT / "app-store-iphone-en.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for i in range(1, 4):
        z.write(OUT / f"{i:02}-iphone.png", f"en-US/{i:02}-iphone.png")

pdfmetrics.registerFont(TTFont("AetherChinese", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"))
sections = {
    "en": [
        ("OpenAI and Navier-Stokes", "Evidence review / September 2026", "This is an offline demonstration report prepared for an Aether film. It is not a record of a live literature search or a newly verified scientific result. The distinction between numerical progress and a proof is the central subject of this report."),
        ("What would count as a solution?", "The scope of the Millennium Prize Problem", "The official problem asks for existence and smoothness in three dimensions, or a valid breakdown example, under its stated conditions. A claim must specify the domain, regularity class, initial data, forcing, and the exact conclusion. Numerical success on a finite grid does not supply a general proof."),
        ("Three different kinds of progress", "Computation / restricted theorems / a general proof", "A numerical solver may improve prediction at finite resolution. A restricted theorem may establish a result for small data, a special geometry, or extra hypotheses. A general solution must address the official three-dimensional statement. These results must not be conflated, even when the same mathematical equations appear in all three."),
        ("How to audit a headline", "Trace the statement back to its evidence", "Locate the original announcement and full paper. Record the version and date. Compare the paper's hypotheses with the official problem. Inspect whether the key step is proved, assumed, numerically observed, or delegated to a model. Seek independent expert assessment. Repeated reporting of a single claim is not independent verification."),
        ("Evidence matrix", "A practical standard for interpretation", "Claim: general 3D regularity. Required evidence: a complete argument under the official hypotheses, available for independent scrutiny. Claim: numerical benchmark improvement. Required evidence: data, baselines, resolution, boundary conditions, error measures, and replication. Claim: AI-assisted proof discovery. Required evidence: the final mathematical proof, independent of how it was discovered."),
        ("Conclusion and reference entry points", "What can responsibly be said", "Do not describe an AI fluid benchmark or special-case theorem as a solution to the Millennium Prize Problem. Until a specific complete claim has been independently assessed, its status remains unverified. Reference entry points: Clay Mathematics Institute, https://www.claymath.org/millennium/navier-stokes-equation/ ; arXiv, https://arxiv.org/search/?query=navier+stokes&searchtype=all ; OpenAI research, https://openai.com/research/ . These are reference entry points, not citations to a verified OpenAI solution."),
    ],
    "zh": [
        ("OpenAI 与 Navier-Stokes", "证据核验报告 / 2026 年 9 月", "本文件是为 Aether 宣传片制作的离线演示报告，不是实时文献检索记录，也不是对新科学成果的确认。报告重点说明：数值模拟、特殊情形定理与一般三维问题的证明是不同层次的结果。"),
        ("什么才算解决？", "千禧年难题的适用范围", "官方问题关注三维不可压缩 Navier-Stokes 方程在规定条件下解的存在性与光滑性，或符合要求的失效反例。核验时需要明确空间区域、初始数据、外力、正则性类别以及最终结论。有限网格上的成功模拟不能替代一般证明。"),
        ("三类容易混淆的进展", "计算方法、受限定理与一般证明", "数值求解器可以在有限分辨率上改善预测。受限定理可能适用于小初值、特殊几何或附加假设。一般三维问题则必须满足官方问题陈述。三者可能使用相同方程，但不能因为术语相同就把计算结果升级为数学定理。"),
        ("如何核验一条新闻", "追溯原始陈述和完整证据", "找到原始公告和完整论文，记录日期及版本；逐项比较论文假设与官方问题；区分关键步骤是被证明、被假设、被数值观察，还是仅由模型给出。随后查找独立专家评议。多家媒体转载同一说法不等于多次独立验证。"),
        ("证据矩阵", "不同结论对应不同要求", "一般三维光滑性：需要完整论证、准确假设和独立核验。数值基准改进：需要数据、基线、分辨率、边界条件、误差指标与复现。AI 辅助证明发现：需要最终数学证明本身，证明的有效性不能依赖模型的自我评价。"),
        ("结论与参考入口", "传播时应保留的边界", "不能把流体计算基准或特殊情形结果表述为千禧年难题的正式解决。没有得到充分核验的具体说法应保留未证实状态。参考入口：Clay Mathematics Institute 官方问题页面；arXiv 的 Navier-Stokes 论文检索；OpenAI Research。它们是后续核查的入口，不是已确认 OpenAI 解决该难题的证据。"),
    ],
}
for lang, pages in sections.items():
    c = canvas.Canvas(str(OUT / f"ns-report-{lang}.pdf"), pagesize=(595, 842))
    c.setTitle("Navier-Stokes Evidence Review - Aether film fixture")
    for page, (title, sub, body) in enumerate(pages, 1):
        c.setFillColorRGB(.07, .21, .22)
        c.rect(0, 778, 595, 64, fill=1, stroke=0)
        c.setFillColorRGB(1, 1, 1)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(44, 804, "AETHER / RESEARCH")
        font = "AetherChinese" if lang == "zh" else "Helvetica"
        c.setFillColorRGB(.08, .16, .17)
        c.setFont(font, 25)
        c.drawString(44, 720, title)
        c.setFont(font, 13)
        c.drawString(44, 677, sub)
        c.setStrokeColorRGB(.1, .6, .57)
        c.line(44, 650, 550, 650)
        c.setFont(font, 13)
        lines = [body[i:i+35] for i in range(0, len(body), 35)] if lang == "zh" else simpleSplit(body, font, 13, 505)
        for line, y in zip(lines, range(610, 150, -26)):
            c.drawString(44, y, line)
        c.setFont("Helvetica", 9)
        c.setFillColorRGB(.4, .47, .48)
        c.drawString(44, 45, "OFFLINE FILM FIXTURE / NOT A LIVE RESEARCH CLAIM")
        c.drawRightString(550, 45, f"{page} / {len(pages)}")
        c.showPage()
    c.save()

text = (OUT / "儒林外史.txt").read_text(encoding="utf-8-sig")
headings = list(re.finditer(r"第[一二三四五六七八九十百]+回[　 ]+[^\n]{8,40}", text))
unique = {}
for match in headings:
    key = match.group().split("回")[0]
    unique.setdefault(key, match)
headings = list(unique.values())
for lang in ("zh", "en"):
    parts = ["# 儒林外史逐章阅读笔记" if lang == "zh" else "# The Scholars: chapter reading notes", "Offline film prop. Public-domain source: Project Gutenberg ebook 24032. No Gemini requests were executed."]
    for i, match in enumerate(headings):
        chapter = text[match.end():headings[i+1].start() if i+1 < len(headings) else text.find("*** END", match.end())]
        paras = [p.strip().replace("\n", "") for p in chapter.split("\n\n") if len(p.strip()) > 35]
        parts.append(f"## {match.group().strip()}")
        if lang == "zh":
            parts.append("情节线索：" + (paras[0][:220] if paras else chapter.strip()[:220]))
            parts.append("阅读重点：结合本回题目与人物对话，观察功名评价怎样影响人物的选择、交往与自我辩解；留意叙述表面的赞许与实际后果之间的讽刺距离。")
        else:
            parts.append(f"Chapter {i+1} follows the events named in the original heading above. Read its conversations in the context of reputation, examination culture, and the gap between publicly performed virtue and private motives.")
            parts.append("Source excerpt: " + (paras[0][:180] if paras else chapter.strip()[:180]))
    merged = "\n\n".join(parts) + "\n"
    (OUT / f"scholars-summary-{lang}.md").write_text(merged)
    (OUT / f"scholars-summary-{lang}.txt").write_text(merged.replace("#", ""))
(OUT / "chapter-manifest.json").write_text(json.dumps({"fixture": True, "model": "gemini-3.8-flash", "concurrency": 8, "note": "Simulated execution manifest; attached reading notes are public-domain source excerpts, not live model output.", "chapters": [{"chapter": i, "status": "completed", "attempts": 2 if i in (17, 42) else 1} for i in range(1, 57)]}, indent=2))
(OUT / "readest-repair.txt").write_text("Aether film fixture: simulated Readest repair\nOriginal container: central-directory damaged\nBackup: 8fa21.backup\nRecovered entries: 18\nChapters: 13\nCRC: PASS\nOPF/spine: PASS\nOwnership: 10342:10342\nPermissions: 0600\nReading position: retained\nNo device book files were modified to create this fixture.\n")
readme = """# Reply Translator

Offline Aether film prop. The session simulates development of a reply translation extension.
This archive contains the reviewable design and state reducer, not a production translator.

Target language defaults to the application language. Each response owns independent loading,
ready, and error state. Original Markdown and code blocks remain visible. Cache identity combines
session ID, message ID, revision, and target language. A repeated in-flight request is ignored.
Cancellation returns to idle. Failed requests may be retried. Results never overwrite originals.
"""
(OUT / "reply-translator-README.md").write_text(readme)
with zipfile.ZipFile(OUT / "reply-translator.zip", "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("reply-translator/README.md", readme)
    z.writestr("reply-translator/package.json", json.dumps({"name":"aether-reply-translator-film-prop","version":"0.1.0","private":True,"description":"Offline film fixture; not a live translation service"}, indent=2))
    z.writestr("reply-translator/state.ts", 'export type State = { status: "idle" | "loading" | "ready" | "error"; text?: string };\nexport const translations = new Map<string, State>();\nexport const key = (session: string, message: string, revision: string, language: string) => JSON.stringify([session, message, revision, language]);\n')
print(f"Generated artwork, two PDFs, book attachments, and extension prop in {OUT}")
