from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from markdown_it import MarkdownIt
from markdown_it.renderer import RendererHTML
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import re, io, html as html_lib

BASE = Path(__file__).resolve().parent.parent
app = FastAPI(title='Persian AI Document Studio', version='2.2.0')
app.mount('/static', StaticFiles(directory=str(BASE / 'app' / 'static')), name='static')

md = MarkdownIt('commonmark', {'html': True, 'breaks': True, 'linkify': True}).enable('table')


def normalize_fa(text: str) -> str:
    return text.replace('\u064a', '\u06cc').replace('\u0643', '\u06a9')


def protect_math(text: str):
    """Extract $$...$$ and $...$ so markdown doesn't mangle them."""
    blocks = []
    inlines = []

    def save_block(m):
        blocks.append(m.group(1).strip())
        return f'\n\n@@MATHBLOCK{len(blocks)-1}@@\n\n'

    def save_inline(m):
        # avoid $$ already handled
        inlines.append(m.group(1))
        return f'@@MATHINLINE{len(inlines)-1}@@'

    # block math first
    text = re.sub(r'\$\$(.+?)\$\$', save_block, text, flags=re.S)
    # inline math (single $ not doubled)
    text = re.sub(r'(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)', save_inline, text, flags=re.S)
    return text, blocks, inlines


def restore_math(html: str, blocks, inlines) -> str:
    for i, b in enumerate(blocks):
        safe = html_lib.escape(b)
        html = html.replace(
            f'@@MATHBLOCK{i}@@',
            f'<div class="math-block" data-math="{safe}"><span class="math-label">∑</span>'
            f'<code class="math-src">{safe}</code></div>'
        )
        # also if wrapped in <p>
        html = html.replace(
            f'<p>@@MATHBLOCK{i}@@</p>',
            f'<div class="math-block" data-math="{safe}"><span class="math-label">∑</span>'
            f'<code class="math-src">{safe}</code></div>'
        )
    for i, b in enumerate(inlines):
        safe = html_lib.escape(b)
        html = html.replace(
            f'@@MATHINLINE{i}@@',
            f'<span class="math-inline" data-math="{safe}"><code>{safe}</code></span>'
        )
    return html


def enhance_code_blocks(html: str) -> str:
    """Add language label and structure around <pre><code class="language-xxx">."""
    def repl(m):
        full = m.group(0)
        lang_m = re.search(r'class="language-([\w+-]+)"', full)
        lang = lang_m.group(1) if lang_m else 'code'
        code_m = re.search(r'<code[^>]*>([\s\S]*?)</code>', full)
        code_inner = code_m.group(1) if code_m else ''
        label = {
            'python': 'Python', 'py': 'Python', 'js': 'JavaScript', 'javascript': 'JavaScript',
            'ts': 'TypeScript', 'html': 'HTML', 'css': 'CSS', 'bash': 'Bash', 'sh': 'Shell',
            'json': 'JSON', 'sql': 'SQL', 'c': 'C', 'cpp': 'C++', 'java': 'Java',
            'go': 'Go', 'rust': 'Rust', 'text': 'Text', 'code': 'Code'
        }.get(lang.lower(), lang)
        return (
            f'<div class="code-block" data-lang="{html_lib.escape(lang)}">'
            f'<div class="code-head"><span class="code-lang">{html_lib.escape(label)}</span>'
            f'<span class="code-copy" data-copy="1">کپی</span></div>'
            f'<pre><code class="language-{html_lib.escape(lang)}">{code_inner}</code></pre>'
            f'</div>'
        )
    return re.sub(r'<pre><code[^>]*>[\s\S]*?</code></pre>', repl, html)


def enhance_tables(html: str) -> str:
    """Wrap tables and mark header cells."""
    html = html.replace('<table>', '<div class="table-wrap"><table class="doc-table">')
    html = html.replace('</table>', '</table></div>')
    return html


def render_markdown(text: str) -> str:
    text = normalize_fa(text)
    text, blocks, inlines = protect_math(text)
    body = md.render(text)
    body = restore_math(body, blocks, inlines)
    body = enhance_code_blocks(body)
    body = enhance_tables(body)
    return f'<article class="document" dir="rtl" lang="fa">{body}</article>'


class RenderIn(BaseModel):
    text: str


@app.get('/', response_class=HTMLResponse)
def index():
    return (BASE / 'app' / 'index.html').read_text(encoding='utf-8')


@app.post('/api/render')
def render(inp: RenderIn):
    return JSONResponse({'html': render_markdown(inp.text)})


@app.get('/api/health')
def health():
    return {'ok': True, 'version': '2.2.0', 'features': ['tables', 'code', 'math', 'docx', 'rtl']}


# ── DOCX ────────────────────────────────────────────────────────────
def set_rtl(p, align=WD_ALIGN_PARAGRAPH.RIGHT):
    pPr = p._p.get_or_add_pPr()
    bidi = OxmlElement('w:bidi')
    bidi.set(qn('w:val'), '1')
    pPr.append(bidi)
    p.alignment = align


def set_font(run, name='Vazir', size=11, bold=False, italic=False):
    run.font.name = name
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    rPr = run._r.get_or_add_rPr()
    rFonts = OxmlElement('w:rFonts')
    for k in ('ascii', 'hAnsi', 'cs', 'eastAsia'):
        rFonts.set(qn('w:' + k), name)
    rPr.append(rFonts)


def set_cell_shading(cell, fill='F0F4F8'):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:fill'), fill)
    shd.set(qn('w:val'), 'clear')
    tcPr.append(shd)


def add_page_number(paragraph):
    run = paragraph.add_run()
    fld = OxmlElement('w:fldSimple')
    fld.set(qn('w:instr'), 'PAGE')
    run._r.addnext(fld)


def markdown_to_docx(text: str):
    doc = Document()
    sec = doc.sections[0]
    sec.top_margin = Cm(2.2)
    sec.bottom_margin = Cm(2.0)
    sec.left_margin = Cm(2.0)
    sec.right_margin = Cm(2.0)

    for sname in ['Normal', 'Title', 'Heading 1', 'Heading 2', 'Heading 3', 'Heading 4']:
        st = doc.styles[sname]
        st.font.name = 'Vazir'
        st.font.size = Pt(11 if sname == 'Normal' else 16)
        st._element.rPr.rFonts.set(qn('w:cs'), 'Vazir')
        st._element.rPr.rFonts.set(qn('w:hAnsi'), 'Vazir')

    footer = sec.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_page_number(footer)

    text = normalize_fa(text)
    lines = text.replace('\r\n', '\n').split('\n')
    i = 0
    in_code = False
    code = []
    lang = ''

    while i < len(lines):
        line = lines[i]

        # fenced code
        if line.strip().startswith('```'):
            if not in_code:
                in_code = True
                lang = line.strip()[3:].strip()
                code = []
            else:
                p = doc.add_paragraph()
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                # language label
                if lang:
                    lab = p.add_run(f'[{lang}] ')
                    set_font(lab, 'Consolas', 8, True)
                r = p.add_run('\n'.join(code))
                set_font(r, 'Consolas', 9)
                in_code = False
            i += 1
            continue
        if in_code:
            code.append(line)
            i += 1
            continue

        # block math $$
        if line.strip().startswith('$$') and line.strip().endswith('$$') and len(line.strip()) > 4:
            formula = line.strip()[2:-2].strip()
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = p.add_run(formula)
            set_font(r, 'Cambria Math', 12, italic=True)
            i += 1
            continue

        if not line.strip():
            i += 1
            continue

        # headings
        m = re.match(r'^(#{1,6})\s+(.*)$', line)
        if m:
            lvl = min(len(m.group(1)), 4)
            p = doc.add_paragraph(style=f'Heading {lvl}')
            set_rtl(p)
            r = p.add_run(m.group(2).strip())
            set_font(r, 'Vazir', max(12, 18 - lvl), True)
            i += 1
            continue

        # lists
        if re.match(r'^[-*+]\s+', line):
            p = doc.add_paragraph(style='List Bullet')
            set_rtl(p)
            r = p.add_run(re.sub(r'^[-*+]\s+', '', line))
            set_font(r)
            i += 1
            continue
        if re.match(r'^\d+\.\s+', line):
            p = doc.add_paragraph(style='List Number')
            set_rtl(p)
            r = p.add_run(re.sub(r'^\d+\.\s+', '', line))
            set_font(r)
            i += 1
            continue

        # quote
        if line.startswith('>'):
            p = doc.add_paragraph()
            set_rtl(p)
            r = p.add_run(line.lstrip('> ').strip())
            set_font(r)
            r.italic = True
            i += 1
            continue

        # table
        if '|' in line and i + 1 < len(lines) and re.match(
            r'^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$', lines[i + 1]
        ):
            rows = []
            while i < len(lines) and '|' in lines[i] and lines[i].strip():
                cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?', c or '') for c in cells):
                    rows.append(cells)
                i += 1
            if rows:
                ncols = max(len(r) for r in rows)
                table = doc.add_table(rows=len(rows), cols=ncols)
                table.style = 'Table Grid'
                table.alignment = WD_TABLE_ALIGNMENT.CENTER
                for ri, row in enumerate(rows):
                    for ci in range(ncols):
                        val = row[ci] if ci < len(row) else ''
                        cell = table.cell(ri, ci)
                        p = cell.paragraphs[0]
                        set_rtl(p)
                        r = p.add_run(val)
                        set_font(r, 'Vazir', 10, ri == 0)
                        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
                        if ri == 0:
                            set_cell_shading(cell, 'E8EEF4')
                continue

        # normal paragraph with inline formatting
        p = doc.add_paragraph()
        set_rtl(p)
        parts = re.split(r'(\$\$.*?\$\$|\$.*?\$|\*\*.*?\*\*|__.*?__|`.*?`|\*.*?\*)', line)
        for part in parts:
            if not part:
                continue
            if part.startswith('$$') and part.endswith('$$'):
                r = p.add_run(part[2:-2])
                set_font(r, 'Cambria Math', 11, italic=True)
            elif part.startswith('$') and part.endswith('$') and len(part) > 2:
                r = p.add_run(part[1:-1])
                set_font(r, 'Cambria Math', 11, italic=True)
            else:
                bold = part.startswith('**') or part.startswith('__')
                codeish = part.startswith('`')
                italic = part.startswith('*') and not bold and not codeish
                clean = (
                    part[2:-2] if bold
                    else (part[1:-1] if (italic or codeish) else part)
                )
                r = p.add_run(clean)
                set_font(r, 'Consolas' if codeish else 'Vazir', 9 if codeish else 11, bold)
                r.italic = italic
        i += 1

    return doc


@app.post('/api/export/docx')
def export_docx(inp: RenderIn):
    doc = markdown_to_docx(inp.text)
    bio = io.BytesIO()
    doc.save(bio)
    return Response(
        bio.getvalue(),
        media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        headers={'Content-Disposition': 'attachment; filename="persian-document.docx"'}
    )
