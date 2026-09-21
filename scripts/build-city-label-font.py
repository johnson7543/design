"""Build the editor's Japanese city-name font from the pinned sign font.

python3 scripts/build-city-label-font.py --sans /path/to/NotoSansCJKjp-Medium.otf
"""

import argparse
import hashlib
from pathlib import Path
import re

from fontTools import subset
from fontTools.ttLib import TTFont


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--sans', required=True, type=Path)
args = parser.parse_args()
source_hash = 'dd523e580e3413c480b2d701bf64e534c20f8419e3cfb6a44c2bdcd8d2a6c052'
if hashlib.sha256(args.sans.read_bytes()).hexdigest() != source_hash:
    parser.error('Unexpected source font')

root = Path(__file__).resolve().parents[1]
presets = (root / 'src/editor/theme-presets.ts').read_text().split(
    'export const CITY_THEME_PRESET_OPTIONS =', 1)[1]
labels = ''.join(re.findall(r"label: '([^']+)'", presets))
license_text = (root / 'packages/designqr/third-party-licenses/noto-cjk.txt').read_text()
license_text = license_text[license_text.index('This Font Software'):]
font = TTFont(args.sans, recalcTimestamp=False)
copyright_notice = font['name'].getDebugName(0)

options = subset.Options()
options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=labels)
subsetter.subset(font)

family = 'DesignQR City Japanese'
names = {
    1: family, 2: 'Medium', 3: 'DesignQR-City-Japanese-Medium',
    4: family + ' Medium', 6: 'DesignQRCityJapanese-Medium',
    13: license_text, 16: family, 17: 'Medium',
}
for record in font['name'].names:
    if record.nameID in names:
        record.string = names[record.nameID].encode(record.getEncoding())
for name_id, value in names.items():
    font['name'].setName(value, name_id, 3, 1, 0x409)
cff = font['CFF '].cff
cff.fontNames[0] = 'DesignQRCityJapanese-Medium'
cff.topDictIndex[0].FamilyName = family
cff.topDictIndex[0].FullName = family + ' Medium'

font.flavor = 'woff'
output = root / 'src/editor/fonts'
output.mkdir(parents=True, exist_ok=True)
font.save(output / 'city-names-ja.woff')
(output / 'city-names-ja-license.txt').write_text(
    f'DesignQR City Japanese — subset of Noto Sans CJK JP Medium\n{copyright_notice}\n'
    'Source: https://github.com/notofonts/noto-cjk/blob/main/Sans/OTF/Japanese/NotoSansCJKjp-Medium.otf\n'
    f'Source SHA-256: {source_hash}\nIncluded labels: {labels}\n\n{license_text}')
print(f'{len(set(labels))} characters; {(output / "city-names-ja.woff").stat().st_size} bytes')

# Keep the CSS coverage in sync with the actual subset.
css_path = root / 'src/index.css'
css = css_path.read_text()
coverage = ', '.join(f'U+{ord(char):04X}' for char in sorted(set(labels)))
css_path.write_text(re.sub(r'unicode-range: [^;]+;', f'unicode-range: {coverage};', css, count=1))
