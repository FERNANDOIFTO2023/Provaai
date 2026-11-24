from pathlib import Path
from pypdf import PdfReader
import ast
import json
import re
import subprocess

root = Path.cwd()
changed = subprocess.check_output(["git", "diff", "--name-only"], text=True).splitlines()
markdown = [root / p for p in changed if p.endswith(".md")] + [root / "docs/README.md"]
checked = 0
broken = []
for path in markdown:
    source = path.read_text(encoding="utf-8")
    for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", source):
        if re.match(r"(?:https?://|mailto:|#|[A-Za-z]:)", target):
            continue
        target = target.split("#")[0]
        if target:
            checked += 1
            if not (path.parent / target).exists():
                broken.append([str(path.relative_to(root)), target])
assert not broken, broken

spec = (root / "docs/ESPECIFICACAO-LTP3-PROVAAI.md").read_text(encoding="utf-8")
assert len(re.findall(r"^\| RF\d{3} \|", spec, re.M)) == 22
assert len(re.findall(r"^\| RNF\d{3} \|", spec, re.M)) == 12
assert "| Equipe |\n\n| 13/11" not in spec
names = ["Fernando de Paula Matos", "Vinicius Celestino", "João Francisco", "Gabriel Gutemberg"]
pdf = root / "docs/ESPECIFICACAO-LTP3-PROVAAI.pdf"
alias = root / "docs/Especificacao-Provaai.pdf"
assert pdf.read_bytes() == alias.read_bytes()
reader = PdfReader(pdf)
texts = [p.extract_text() or "" for p in reader.pages]
full = " ".join(" ".join(texts).split())
for name in names + ["Marcos Raimundo", "24/11/2026"]:
    assert name in " ".join(texts[0].split()), name
for name in names:
    assert name in reader.metadata.author, name
assert not re.search(r"\[Nome|\b(?:ChatGPT|Codex|ECC|Copilot|Claude)\b|\ufffd", full, re.I)
for text in ["RF022", "RNF012", "Importação de alunos", "Materiais e pesquisa externa", "Indicadores e calendário", "SymPy", "Gemini", "Groq"]:
    assert text in full, text
assert all(len(t.strip()) > 200 for t in texts)
ast.parse((root / "docs/tools/render-specification.py").read_text(encoding="utf-8"))
print(json.dumps({"markdowns_checked": len(markdown), "local_links_checked": checked,
                  "broken_links": broken, "pdf_pages": len(reader.pages), "pdf_copies_identical": True,
                  "names_and_metadata": "passed", "requirements": "22 RF / 12 RNF",
                  "renderer_syntax": "passed", "placeholders_and_assistant_authorship": "absent"}, indent=2))
