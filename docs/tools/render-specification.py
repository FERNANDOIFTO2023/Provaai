"""Gera os dois PDFs acadêmicos a partir da especificação Markdown única.

Uso: python docs/tools/render-specification.py --font-regular CAMINHO --font-bold CAMINHO
Dependência de documentação: reportlab. Não carrega configurações da aplicação.
"""

import argparse
import re
import shutil
from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
)


def inline(text):
    """Preserva o texto de links e destaques, escapando o conteúdo antes do PDF."""
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", text)
    text = escape(text.replace("—", "-").replace("–", "-"))
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    return re.sub(r"`([^`]+)`", r"\1", text)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--font-regular", type=Path, required=True)
    parser.add_argument("--font-bold", type=Path, required=True)
    args = parser.parse_args()
    for name, path in [("Texto", args.font_regular), ("TextoBold", args.font_bold)]:
        pdfmetrics.registerFont(TTFont(name, str(path)))
    pdfmetrics.registerFontFamily("Texto", normal="Texto", bold="TextoBold")

    docs = Path(__file__).resolve().parents[1]
    source = docs / "ESPECIFICACAO-LTP3-PROVAAI.md"
    lines = source.read_text(encoding="utf-8").splitlines()
    body_start = next(i for i, line in enumerate(lines) if line.startswith("# 1."))
    identification = [line for line in lines[1:body_start] if line.strip()]
    professor = next(line for line in identification if line.startswith("Professor:"))
    team = next(line.removeprefix("Equipe: ") for line in identification if line.startswith("Equipe:"))
    names = team.replace(" e ", ", ").split(", ")
    revision = next(line for line in identification if line.startswith("Revisão documental:"))

    # Medidas e cores recuperadas do PDF acadêmico anterior: composição institucional,
    # Times New Roman, grade completa e cabeçalhos em verde acinzentado.
    palette = {"ink": colors.black, "heading": colors.HexColor("#18251f"),
               "muted": colors.HexColor("#58625b"), "line": colors.HexColor("#9caaa1"),
               "pale": colors.HexColor("#e8eeea")}
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("Texto", fontName="Texto", fontSize=11, leading=15.5,
                              textColor=palette["ink"], alignment=TA_JUSTIFY, spaceAfter=9))
    styles.add(ParagraphStyle("Secao", parent=styles["Texto"], fontName="TextoBold",
                              fontSize=14, leading=18, alignment=TA_LEFT, textColor=colors.black,
                              spaceBefore=12, spaceAfter=10, keepWithNext=True))
    styles.add(ParagraphStyle("Subsecao", parent=styles["Secao"], fontSize=12, leading=16,
                              spaceBefore=10, spaceAfter=8))
    styles.add(ParagraphStyle("Celula", parent=styles["Texto"], fontSize=10, leading=13,
                              alignment=TA_LEFT, spaceAfter=0))
    styles.add(ParagraphStyle("Cabecalho", parent=styles["Celula"], fontName="TextoBold"))

    output = docs / "ESPECIFICACAO-LTP3-PROVAAI.pdf"
    doc = SimpleDocTemplate(str(output), pagesize=A4, rightMargin=56, leftMargin=56,
                            topMargin=62, bottomMargin=48,
                            title="Provaai - Documento de especificação",
                            author="; ".join(names), creator="Documentação do projeto Provaai",
                            subject="Linguagens e Técnicas de Programação III - " + revision.split(".")[0])
    # A capa usa as mesmas posições do documento anterior. Seu texto vem do Markdown;
    # o logotipo foi extraído sem alterações do PDF versionado no repositório.
    logo = docs / "assets/ifto-academico.png"
    if not logo.is_file():
        raise FileNotFoundError(f"Logotipo institucional não encontrado: {logo}")
    story = [Spacer(1, 1), PageBreak()]
    p = lambda text, style="Texto": Paragraph(inline(text), styles[style])

    # O parser atende ao subconjunto usado na especificação: títulos, parágrafos e tabelas.
    i = body_start
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [cell.strip() for cell in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", cell) for cell in cells):
                    rows.append(cells)
                i += 1
            count = len(rows[0])
            if any(len(row) != count for row in rows):
                raise ValueError("Tabela com quantidade inconsistente de colunas")
            if count == 4:
                widths = [70, 44, doc.width-164, 50]
            elif count == 2:
                first = 70 if rows[0][0] == "Código" else 130
                widths = [first, doc.width-first]
            else:
                widths = [doc.width/count] * count
            table = Table([[p(cell, "Cabecalho" if r == 0 else "Celula") for cell in row]
                           for r, row in enumerate(rows)],
                          colWidths=widths, repeatRows=1, hAlign="LEFT")
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), palette["pale"]),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafbf9")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("GRID", (0, 0), (-1, -1), .4, palette["line"]),
            ]))
            story += [table, Spacer(1, 9)]
            continue
        if line.startswith("# "):
            if i != body_start:
                story.append(PageBreak())
            heading = p(line[2:], "Secao")
            next_line = next((item.strip() for item in lines[i+1:] if item.strip()), "")
            heading.keepWithNext = not next_line.startswith("|")
            story.append(heading)
        elif line.startswith("## "):
            if line.startswith(("## 3.2 ", "## 3.3 ")):
                story.append(PageBreak())
            heading = p(line[3:], "Subsecao")
            next_line = next((item.strip() for item in lines[i+1:] if item.strip()), "")
            heading.keepWithNext = not next_line.startswith("|")
            story.append(heading)
        else:
            paragraph = [line]
            while i + 1 < len(lines) and lines[i+1].strip() and not lines[i+1].startswith(("#", "|")):
                i += 1
                paragraph.append(lines[i].strip())
            story.append(p(" ".join(paragraph)))
        i += 1

    def furniture(canvas, document):
        canvas.saveState()
        width, height = A4
        if document.page == 1:
            canvas.setFillColor(colors.black)
            canvas.drawImage(str(logo), (width-50)/2, height-133, width=50, height=79, mask="auto")
            institution, campus = identification[0].split(" — ", 1)
            canvas.setFont("Texto", 11.2)
            for offset, text in [(148, institution), (163, campus), (178, identification[1])]:
                canvas.drawCentredString(width/2, height-offset, text.upper())
            canvas.setFont("TextoBold", 13)
            canvas.drawCentredString(width/2, height-325, "DOCUMENTO DE ESPECIFICAÇÃO: PROVAAI")
            canvas.setFont("Texto", 11.5)
            canvas.drawString(56, 270, "DISCIPLINA: " + identification[2].split(": ", 1)[1])
            canvas.drawString(56, 251, "PROFESSOR: " + professor.split(": ", 1)[1])
            canvas.drawString(56, 232, "EQUIPE DE DESENVOLVIMENTO:")
            for index, name in enumerate(names):
                canvas.drawString(56, 213-index*19, "    " + name)
            canvas.drawCentredString(width/2, 52, "Paraíso do Tocantins — 2026")
        else:
            canvas.setFont("Texto", 9)
            canvas.setFillColor(palette["muted"])
            canvas.drawString(56, height-31, "PROVAAI - DOCUMENTO DE ESPECIFICAÇÃO - LTP III")
            canvas.setStrokeColor(palette["heading"])
            canvas.setLineWidth(.8)
            canvas.line(56, height-38, width-56, height-38)
            canvas.drawRightString(width-56, 29, str(document.page))
        canvas.restoreState()

    doc.build(story, onFirstPage=furniture, onLaterPages=furniture)
    # O nome anterior é mantido por compatibilidade, sempre com o mesmo conteúdo.
    alias = docs / "Especificacao-Provaai.pdf"
    shutil.copyfile(output, alias)
    print(f"PDFs sincronizados: {output.name} e {alias.name}")


if __name__ == "__main__":
    main()
