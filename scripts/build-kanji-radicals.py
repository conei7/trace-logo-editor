"""Generate the elementary-kanji radical lookup from Unicode 18.0 data.

Usage: python scripts/build-kanji-radicals.py Unihan.zip CJKRadicals.txt
Sources: https://www.unicode.org/Public/UCD/latest/ucd/
"""

import json
import re
import sys
import zipfile
from pathlib import Path


root = Path(__file__).resolve().parent.parent
source = (root / "app.js").read_text(encoding="utf-8")
grades = re.search(r"const KANJI_GRADE_CHAR_SETS = \{(.*?)\n\};", source, re.S).group(1)
chars = dict.fromkeys("".join(re.findall(r'\d: splitGraphemes\("([^"]+)"\)', grades)))

radicals = {}
with zipfile.ZipFile(sys.argv[1]) as archive:
    for line in archive.read("Unihan_IRGSources.txt").decode("utf-8").splitlines():
        fields = line.split("\t")
        if len(fields) != 3 or fields[1] != "kRSUnicode":
            continue
        char = chr(int(fields[0][2:], 16))
        if char in chars:
            radicals[char] = list(dict.fromkeys(int(value.split(".")[0].rstrip("'")) for value in fields[2].split()))

names = {}
for line in Path(sys.argv[2]).read_text(encoding="utf-8").splitlines():
    if line.startswith("#") or not line.strip():
        continue
    number, radical, ideograph = (field.strip() for field in line.split(";"))
    key = number.rstrip("'")
    candidates = names.setdefault(key, [])
    for value in (radical, ideograph):
        if value:
            name = chr(int(value, 16))
            if name not in candidates:
                candidates.append(name)

missing = set(chars) - radicals.keys()
if missing:
    raise ValueError(f"Missing radical data for: {''.join(sorted(missing))}")

output = (
    "// Generated from Unicode 18.0 Unihan_IRGSources.txt and CJKRadicals.txt.\n"
    "// https://www.unicode.org/terms_of_use.html\n"
    f"const KANJI_RADICAL_NUMBERS = {json.dumps(radicals, ensure_ascii=False, separators=(',', ':'))};\n"
    f"const KANGXI_RADICAL_NAMES = {json.dumps(names, ensure_ascii=False, separators=(',', ':'))};\n"
)
(root / "kanji-radicals.js").write_text(output, encoding="utf-8")
print(f"Generated {len(radicals)} kanji radical entries")
