# Design QR color mappings

Status: Active product specification<br>
Scope: Design QR seasonal and City artwork and renderer/component color assignments

[Back to the Design QR documentation index](README.md)

This document defines how Design QR uses colors from the
[global repository allowlist](../design-system/colors.md). It does not authorize
new base colors; every referenced color must remain globally approved.

## Interface syntax theme

Share-modal code examples use a light, Spring-aligned syntax palette. These
roles affect generated HTML, shell, and TSX presentation only; they do not alter
the rendered QR artwork.

| Role | Hex | Applied component mapping |
| --- | --- | --- |
| Keyword | `#98596E` | Imports, exports, declarations, and control-flow words |
| String | `#286018` | URLs, package names, labels, and string values |
| Tag / component | `#3A8EF5` | HTML tags and React component identifiers |
| Property | `#A45E22` | JSX props, object keys, and shell actions |
| Number | `#E77433` | Numeric configuration values |
| Literal | `#DB2777` | Boolean, null, and undefined literals |
| Comment | `#A89888` | Generated guidance comments |
| Punctuation | `#7D6B5C` | Brackets, operators, and separators |

## Editor preview zoom chrome

The left floating zoom disclosure reuses the Edit / Logo pill roles. Its
popover uses `--qr-surface-elevated`, `--qr-border-default`, and
`--qr-shadow-control-hover`; labels use `--qr-ink` and `--qr-ink-muted`.
Minus, percentage/reset, and plus use `--qr-surface-control`, the existing
control-hover and warm-pressed surfaces, accent borders, and the shared
`--qr-focus-color` outline. Limit-disabled buttons reduce opacity only. These
are interface roles, not new palette entries. Render-aware preview zoom applies
no color filter and changes neither palette assignments nor exported PNG colors.

## Package presentation roles

The public React player and hosted iframe define these roles under
`.designqr-root`; they do not depend on application-level `--qr-*` tokens.
Canvas roles are shared by the live presentation and exported PNG. Focus roles
remain browser UI and are not exported. Theme-owned `titleColor` remains
separate. At the settled 2D endpoint, transparent output reuses the QR light
color: Tree's theme-derived lifted ground color, or City's exact derived mist
paper without a lift. Both designs fill exactly the matrix when Border is disabled.
Only enabling Border uses that color to
fill the complete details card, including its four-module clear QR margin; no new
base color is introduced. Opaque borderless output retains the seasonal
background outside the QR matrix without an extra local surround. When `transparentBackground` is enabled,
the full-canvas atmosphere gradient is not painted and pixels outside the
design-owned scan fill or enabled Border card remain transparent. The editor-only
alpha checkerboard derives from existing semantic interface tokens and is not
part of the package canvas or PNG.

| Role | Package variable | Approved color | Applied component mapping |
| --- | --- | --- | --- |
| Detail content | `--designqr-content-color` | `#3F352B` | Visible QR value |
| Detail border | `--designqr-border-color` | `rgba(95, 78, 61, 0.25)` from `#5F4E3D` | Outer detail frame and shadow |
| Border highlight | `--designqr-border-highlight-color` | `rgba(255, 255, 255, 0.45)` from `#FFFFFF` | Inner detail-frame highlight |
| Focus | `--designqr-focus-color` | `#3F352B` | Primary keyboard focus ring |
| Focus contrast | `--designqr-focus-contrast-color` | `#FFFFFF` | Focus-ring contrast edge over custom themes |

## Seasonal mappings

Whenever adjusting or adding a curated seasonal swatch, document its name, hex
value, RGB values in both 0–255 and normalized formats, and component mapping in
the corresponding seasonal table. Exact procedural tones may be
grouped as ordered hex tuples in the renderer-distribution tables, where their
order, thresholds, variation, and component mapping are the maintained
contract.

### Public theme role contract

[`TREE_THEME_PRESETS`](../../packages/designqr/src/designs/tree/themes.ts) is the
runtime source of truth for the complete preset objects. A custom theme may
override any of these public role groups through `createTreeTheme()`; the
renderer consumes the normalized resolved object and does not identify a preset
by its season index or a magic color value.

| Role group | Public fields | Renderer mapping |
| --- | --- | --- |
| Organic foliage | `foliageColor`, tonal roles, `foliagePaletteColors`, `foliagePaletteStops`, `foliageColorVariation`, `foliageVerticalLift`, `foliageShape`, `blossomCenterColor` | Canopy, falling foliage, and ground leaves |
| QR foliage | `qrFoliageColor`, tonal roles, `qrFoliagePaletteColors`, `qrFoliagePaletteStops`, `qrFoliageColorVariation` | Multi-tone morph voxels and settled QR modules, with or without a logo |
| Branches | `branchColor`, `branchShadowColor`, `branchHighlightColor`, `branchTipColor`, `branchStyle` | Procedural trunk and branch vertex colors |
| Ground | `groundColor`, surface roles and variations, `pedestalColor` | Theme source for the shared 2D light-module, transparent matrix fill, and optional Border-card fill, plus 3D pavers and the temporary 3D island slab |
| Ground decor | `groundFeature*` roles, palettes, stops, and variations | Four-band 3D grass/pixel ramps; None omits the geometry while retaining the configured roles for later reuse |
| Finder modules | `qrFinder*` roles, palettes, stops, and variations | Multi-tone QR finder modules for Grass and Pixel; None keeps the finder modules but routes them through the QR foliage roles |
| Atmosphere | `skyTop`, `skyBottom`, `weather*`, `ambientParticle*`, `snowflake*` | Opaque-mode presentation gradient, rain, butterflies/fireflies, and snow; sky values remain resolved but unpainted while the background is transparent |
| Procedural layout | `groundLeavesAmount` | Fallen-leaf count and content-derived placement shared by preset, Add Theme, and package rendering |
| Metadata | `titleColor` | QR title rendered by the live presentation surface |

Preset objects are immutable. `createTreeTheme(preset, overrides)` returns a new
complete object. Partial custom themes are part of the current API; they resolve
missing roles from their own main foliage/ground colors and shared neutral
artwork defaults. The editor's `THEME_PRESET_OPTIONS` contains only selection
metadata; Add Theme uses `createTreeTheme()` and `TREE_THEME_PRESETS` directly.
Saving an untouched custom setup resolves to the same complete roles and
procedural distributions as the source preset.

Source-tone overrides use the same dependency cascade in `createTreeTheme()`
and Add Theme. Unless explicitly supplied with the override, dependent canopy,
QR, finder, surface, pedestal, and title roles are released and re-derived from
the edited source colors. Particle selection likewise composes one complete,
exclusive renderer setup instead of retaining hidden effects from the source
preset.

### Preset renderer-distribution contract

The ordered tuples below preserve the visual distributions used before theme
resolution moved into the package. A renderer refactor may consume these values
differently only if the resulting 3D, turning, and ordinary 2D artwork remains
visually equivalent. Stops are cumulative sampler thresholds; `var` is the
maximum normalized RGB jitter range before the sampler's `-0.5…0.5` factor.
Paver, pedestal, and bark entries are display-sRGB equivalents of the
pre-refactor renderer’s linear RGB coefficients; storing the coefficients as hex
would incorrectly apply sRGB decoding and darken the artwork.

| Preset | Organic canopy tuple · stops · var | QR foliage tuple · stops · var | QR finder tuple · stops · var · eye |
| --- | --- | --- | --- |
| Spring | `#D98EAF`, `#F4B4CF`, `#F8D2E3`, `#FCEEF5`, `#FCEEF5` · `.35/.70/.92/1` · `.00525` | `#8C3D59`, `#A84D66`, `#BD577A`, `#D1668A` · `.22/.48/.78` · `.03` | `#428A2E`, `#619E38`, `#478F2E`, `#94A32E` · `.35/.75/.90` · `.0035` · `#337A24` |
| Summer | `#00785E`, `#02983B`, `#00AC7A`, `#99CC81`, `#99CC81` · `.28/.65/.86/1` · `.0028` | `#005A46`, `#00785E`, `#02983B`, `#00AC7A` · `.22/.52/.80` · `.03` | `#6B9277`, `#99CC81`, `#D7DE8A`, `#D7DE8A` · `.35/.75/1` · `.0035` · `#02983B` |
| Autumn | `#BD3528`, `#E2451E`, `#E77433`, `#F4A358`, `#F4A358` · `.22/.55/.82/1` · `.00525` | `#8C2016`, `#BD3528`, `#E2451E`, `#E77433` · `.22/.52/.80` · `.03` | `#9D8C73`, `#BD956E`, `#F4A358`, `#F4A358` · `.35/.75/1` · `.0035` · `#5D4C35` |
| Winter | `#6185A6`, `#8CADD1`, `#BDD6F0`, `#F5FAFF`, `#A6D6E6` · `.18/.44/.72/.90` · `.0175` | `#3D668F`, `#5C85AD`, `#7AA3C7`, `#99BDDB` · `.22/.56/.82` · `.03` | `#476B8F`, `#6185A8`, `#7A9EBD`, `#7A9EBD` · `.35/.75/1` · `.035` · `#335270` |

| Preset | Light/dark 3D paver · variation · pedestal | Ground-decoration start → end tuples · stops · per-band var | Branch shadow/base/highlight/tip | Presentation correction |
| --- | --- | --- | --- | --- |
| Spring | `#EBDBD3` / `#CFB5B9` · `.016/.04` · `#A99FA3` | `#85B667/#BFD47B/#F7E95E/#D0D3E2` → same · `.42/.72/.88` · `.04/.04/0/0` | `#795538/#956F50/#B18B69/#C2A27C` | Existing Spring sky roles; `groundColor #F1CDBD` preserves the established 2D source coefficients |
| Summer | `#BEC7B5` / `#A2BAA9` · `.016/.04` · `#B1B1B8` | `#1F9E24/#6BE01F/#F0D133/#0F6114` → `#33C224/#99F51F/#F0EB59/#0F6114` · `.40/.70/.88` · `0/0/0/0` | `#795538/#956F50/#B18B69/#C2A27C` | Existing Summer sky and `groundColor` roles |
| Autumn | `#DACEBC` / `#BDB3A4` · `.016/.04` · `#B1B1B8` | `#9D8C73/#BD956E/#F4A358/#5D4C35` → same · `.40/.70/.88` · `.004/.004/.004/0` | `#795538/#956F50/#B18B69/#C2A27C` | Existing Autumn sky and `groundColor` roles |
| Winter | `#D4D4D1` / `#BFBFBC` · `.04/.05` · `#B1B1B8` | `#F5FAFF/#F5FAFF/#F5FAFF/#F5FAFF` → same · `.35/.75/1` · `0/0/0/0`; rendered as axis-aligned ground pixels | `#766961/#908176/#A69990/#B8B1AA` | `skyTop #F2F5FA`; `skyBottom` and `groundColor #F5F7FB` |

Ground surface decor selection never rewrites its configured palette roles. A
Grass ↔ Pixel change is geometry-only. None omits that 3D geometry and, during
the turn into 2D, routes the required finder modules through the QR foliage
roles instead of the distinct finder palette. Finder geometry remains intact
for scanning. In particular, Winter remains the all-white decor ramp after a
Pixel → Grass (or None) → Pixel round trip.

Tree's settled 2D output samples the QR foliage tuple and, for Grass or Pixel, the
finder tuple above whether or not a logo is configured. None samples the
foliage tuple for all dark modules. Logo mode retains those distributions and
instead switches QR generation to high error correction while keeping the
frame-free image within the bounded size range. After the dark-module color is
resolved, one shared 2D depth filter preserves hue while multiplying HSL
saturation by `1.12` and lightness by `.874`. The shared grade provides the
contrast needed by the frame-free logo path without changing when a logo is
enabled or removed, so every sampled palette tone remains identical in both
states. The filter blends in with the scan-face transition and does not affect
the 3D artwork, light modules, or theme source values. Light modules instead
pass the selected preset or custom theme's `groundColor` through one shared
standard sRGB display lift. That separate treatment preserves the brighter
reference negative space without assigning one fixed light color across themes,
and the 3D source remains intact.

---

### 🌸 1. Spring (春 — Traditional Japanese Swatch Book Palette)

#### A. Canopy Blossom & Flora Palette (和の春色配色)
| # | Swatch Name | Japanese / Kanji | CMYK | Hex Code | RGB (0–255) | Normalized RGB (0.0–1.0) | Applied Component Mapping |
|---|---|---|---|---|---|---|---|
| **①** | **華曇** (Hanagumori) | はなぐもり | C15 M10 Y0 K10 | `#D0D3E2` | `208, 212, 227` | `[0.816, 0.831, 0.890]` | Ambient Mist Wildflower Blades |
| **②** | **花日和** (Hanabiyori) | はなびより | C35 M17 Y0 K0 | `#AEC4E6` | `175, 197, 230` | `[0.686, 0.773, 0.902]` | Spring Sky Tone Accent, Cool Shadow Highlights |
| **③** | **若草色** (Wakakusairo) | わかくさいろ | C47 M0 Y67 K15 | `#85B667` | `134, 182, 104` | `[0.525, 0.714, 0.408]` | Fresh Meadow Grass Base and turning QR finder accents |
| **④** | **萌黃色** (Moegiiro) | もえぎいろ | C27 M0 Y60 K7 | `#BFD47B` | `192, 213, 123` | `[0.753, 0.835, 0.482]` | Tender Sprout Yellow-Green Grass Blades, 2D Finder Pattern Accents |
| **⑤** | **油菜花色** (Nanohanairo) | なのはないろ | C0 M0 Y70 K7 | `#F7E95E` | `247, 234, 94` | `[0.969, 0.918, 0.369]` | 3D Blossom Flower Pistil Center Disc, Wildflower Accents |
| **⑥** | **花衣** (Hanagoromo) | はなごろも | C0 M50 Y0 K15 | `#D98EAF` | `217, 142, 176` | `[0.851, 0.557, 0.690]` | Sakura Blossom Shadow Layers, deep petals, and turning QR voxel accents |
| **⑦** | **花明** (Hanaakari) | はなあかり | C0 M10 Y0 K0 | `#FCEEF5` | `253, 239, 245` | `[0.992, 0.937, 0.961]` | Translucent Blossom Tips |
| **⑧** | **染井吉野** (Somei-Yoshino) | そめいよしの | C0 M25 Y0 K0 | `#F8D2E3` | `249, 211, 227` | `[0.976, 0.827, 0.890]` | Classic Sakura Petals, Fallen Ground Petal Layer, Pink Grass Wildflowers |
| **⑨** | **八重紅枝垂櫻** (Yae-Beni-Shidare) | やえべにしだれざくら | C0 M40 Y0 K0 | `#F4B4CF` | `244, 180, 208` | `[0.957, 0.706, 0.816]` | Vibrant Sakura Blossom Canopy Midtones, 2D QR Foliage Mosaic |
| **⑩** | **Deep Leaf Green** | — | C58 M0 Y75 K62 | `#286018` | `40, 96, 24` | `[0.157, 0.376, 0.094]` | Public Spring ground-feature and finder shadow role; exact ordinary QR output uses the maintained tuple above |

#### B. Spring Ground & Terrace Palette (028 春分 Shunbun Ground Guide)
| # | Swatch Name | Japanese / Kanji | CMYK | Hex Code | RGB (0–255) | Normalized RGB (0.0–1.0) | Applied Component Mapping |
|---|---|---|---|---|---|---|---|
| **①** | **色音** (Irone) | いろね | C5 M25 Y23 K0 | `#F0CCBD` | `241, 205, 189` | `[0.945, 0.804, 0.741]` | 3D Courtyard Stone Paver Light Tint (`TreeBlockType.Dirt`) |
| **②** | **終日** (Hinemosu) | ひねもす | C3 M40 Y17 K27 | `#C38F95` | `195, 144, 150` | `[0.765, 0.565, 0.588]` | Courtyard Stone Shadow Pavers, Fallen Ground Petal Layer |
| **③** | **紅掛花色** (Benikakehanairo) | べにかけはないろ | C15 M60 Y20 K40 | `#98596E` | `153, 89, 110` | `[0.600, 0.349, 0.431]` | Spring QR shadow role and Spring title accent |
| **④** | **曙** (Akebono) | あけぼの | C0 M40 Y53 K0 | `#F5AF77` | `245, 175, 120` | `[0.961, 0.686, 0.471]` | Dawn Warm Highlight Accents |
| **⑤** | **朧月** (Oborozuki) | おぼろづき | C0 M15 Y35 K0 | `#FCE0AF` | `253, 225, 176` | `[0.992, 0.882, 0.690]` | Warm Spring Sunlit Paver Highlights |
| **⑥** | **東雲色** (Shinonomeiro) | しののめいろ | C0 M43 Y35 K0 | `#F3AA96` | `244, 170, 150` | `[0.957, 0.667, 0.588]` | Dawn Horizon Sky / Ground Glow Accents |
| **⑦** | **藍色鳩羽** (Aiirohatoba) | あいいろはとば | C30 M35 Y25 K60 | `#64585C` | `101, 89, 93` | `[0.396, 0.349, 0.365]` | Linear source coefficient for the Spring pedestal family; its display-sRGB runtime value is `#A99FA3` |
| **⑧** | **白羽之矢** (Shirahanoya) | しらはのや | C0 M5 Y10 K0 | `#FEF6E9` | `255, 246, 233` | `[1.000, 0.965, 0.914]` | Website Atmosphere Background, 2D Light QR Modules (`TreeBlockType.Dirt`) |
| **⑨** | **埋木** (Umoregi) | うもれぎ | C25 M50 Y33 K75 | `#4F3235` | `79, 50, 53` | `[0.310, 0.196, 0.208]` | Deep Pedestal Base Core |

*Trunk & Branches*: Shared textured antique bark uses display-sRGB ordered
`#795538/#956F50/#B18B69/#C2A27C` shadow, base, ridge, and tip roles.

---

### ☀️ 2. Summer (夏 — 日本傳統色・033 立夏 翠竹與初夏生長之綠)

#### Traditional Japanese Summer Palette (033 立夏・萬葉集綠意配色)
> **季節意象**: 5月6日~20日前後（立夏）。陽光日漸增強，綠葉更加繁茂，水嫩、新鮮、清爽的翠綠成長意象。

| # | Swatch Name | Japanese / Kanji | CMYK | Hex Code | RGB (0–255) | Normalized RGB (0.0–1.0) | Applied Component Mapping |
|---|---|---|---|---|---|---|---|
| **①** | **青竹色** (Aotakeiro) | あおたけいろ | C77 M0 Y65 K0 | `#00AC7A` | `0, 173, 122` | `[0.000, 0.678, 0.478]` | Fresh Bamboo Midtone Foliage Accent, Summer Vibrancy Accent |
| **②** | **薄綠** (Usumidori) | うすみどり | C45 M0 Y35 K0 | `#95CFB6` | `150, 208, 182` | `[0.588, 0.816, 0.714]` | Soft Translucent Green Ambient Layer |
| **③** | **深綠** (Fukamidori) | ふかみどり | C85 M0 Y60 K45 | `#00785E` | `0, 121, 95` | `[0.000, 0.475, 0.373]` | Deep forest canopy shadow, Summer QR palette tone, and Summer title accent |
| **④** | **翠玉** (Suigyoku) | すいぎょく | C80 M15 Y100 K0 | `#02983B` | `2, 153, 59` | `[0.008, 0.600, 0.231]` | Main Hero Foliage Body Color (`foliageColor`, `foliageHex`), QR Finder Pattern Center Eyes |
| **⑤** | **若苗色** (Wakanaeiro) | わかなえいろ | C45 M0 Y60 K0 | `#99CC81` | `154, 204, 130` | `[0.604, 0.800, 0.510]` | Gentle Warm Sunlit Leaf Tips (`foliageHighlightColor`), Grass Blades in 4 Corners (`grassColor`) |
| **⑥** | **花水木** (Hanamizuki) | はなみずき | C5 M3 Y20 K0 | `#F6F4D7` | `246, 244, 216` | `[0.965, 0.957, 0.847]` | Soft Sunlight Atmosphere Canvas, 2D Light QR Modules, Sky Top Tone (`skyTop`, `dirtColor`) |
| **⑦** | **嬰兒** (Midorigo) | みどりご | C20 M5 Y55 K0 | `#D7DE8A` | `216, 222, 138` | `[0.847, 0.871, 0.541]` | Fresh Sprout Golden Glow, Petal & Wildflower Accents (`petalColor`, `skyBottom`, `sunColor`) |
| **⑨** | **利休鼠** (Rikyūnezu) | りきゅうねず | C60 M27 Y55 K10 | `#6B9277` | `108, 147, 119` | `[0.424, 0.576, 0.467]` | Tea-Green Gray Dark Stone Paver Shadows, QR Finder Base Accents |

> **樹幹與樹枝 (Trunk & Branches)**:
> 樹幹與樹枝採用跨季節共享的經典自然老木樹皮紋理，依序使用顯示用
> sRGB `#795538/#956F50/#B18B69/#C2A27C` 的陰影、基色、凸紋與枝梢色。

---

### 🍂 3. Autumn (秋 — 日本傳統色・小雪 楓葉與清水寺燃燒之火)

#### Traditional Japanese Autumn Palette (京都清水寺 楓葉配色)
> **季節意象**: 11月22日~12月6日前後（小雪・立冬 楓葉盛景）。京都清水寺染上紅色的樹葉，宛如燃燒的火焰。

| # | Swatch Name | Japanese / Kanji | CMYK | Hex Code | RGB (0–255) | Normalized RGB (0.0–1.0) | Applied Component Mapping |
|---|---|---|---|---|---|---|---|
| **①** | **紅葉** (Momiji) | もみじ・こうよう | C0 M85 Y90 K5 | `#E2451E` | `226, 69, 31` | `[0.886, 0.271, 0.122]` | Vibrant Flaming Red Maple Leaves, Hero Foliage Color, 2D QR Dark Modules |
| **②** | **楓** (Kaede) | かえで | C0 M65 Y80 K5 | `#E77433` | `231, 117, 52` | `[0.906, 0.459, 0.204]` | Warm Maple Orange Foliage Midtones, Secondary Leaf Gradient |
| **③** | **紅絹** (Momi) | もみ | C20 M90 Y87 K10 | `#BD3528` | `189, 53, 41` | `[0.741, 0.208, 0.161]` | Deep Crimson Shadow Foliage, Fallen Ground Leaves (`petalColor`), 2D QR Core, Autumn QR Title Accent (`titleHex`) |
| **④** | **小春日和** (Koharubiyori) | こはるびより | C0 M45 Y67 K0 | `#F4A358` | `244, 164, 88` | `[0.957, 0.643, 0.345]` | Warm Golden Amber Leaf Highlights, Horizon Sky Sunset Glow (`skyBottom`, `sunColor`) |
| **⑤** | **酒林** (Sakabayashi) | さかばやし | C0 M30 Y45 K33 | `#BD956E` | `190, 150, 110` | `[0.745, 0.588, 0.431]` | Cedar Brown Branch Highlights, Dried Grass Accents |
| **⑥** | **初雪** (Hatsuyuki) | はつゆき | C3 M7 Y7 K0 | `#F8F0EC` | `248, 240, 236` | `[0.973, 0.941, 0.925]` | Website Atmosphere Canvas, 2D Light QR Modules, Sky Top Tone (`skyTop`, `dirtColor`) |
| **⑦** | **檜舞台** (Hinokibutai) | ひのきぶたい | C0 M17 Y33 K30 | `#C6AE8D` | `198, 175, 142` | `[0.776, 0.686, 0.557]` | Cypress Stage Courtyard Stone Paver Floor (`ambientColor`, 3D Ground Pavers) |
| **⑧** | **冬草** (Fuyukusa) | ふゆくさ | C45 M45 Y55 K0 | `#9D8C73` | `158, 140, 115` | `[0.620, 0.549, 0.451]` | Withered Autumn Grass Blades in 4 Corners (`grassColor`), QR Finder Pattern Lawn |
| **⑨** | **山眠** (Yamanemuru) | やまねむる | C45 M50 Y65 K53 | `#5D4C35` | `94, 77, 54` | `[0.369, 0.302, 0.212]` | Deep Antique Tree Trunk & Branch Bark (`trunkColor`), QR Finder Center Eyes |

---

### ❄️ 4. Winter (冬 — Crystal Ice Blue, Frost Slate & Snow White)

| # | Tone Name | Hex Code | RGB (0–255) | Normalized RGB (0.0–1.0) | Applied Component Mapping |
|---|---|---|---|---|---|
| **①** | **Deep Frost Slate** | `#577a9e` | `87, 122, 158` | `[0.34, 0.48, 0.62]` | 3D Canopy Ice Shadow, 2D QR Dark Core, Winter QR Title Accent (`titleHex`) |
| **②** | **Silver Blue Crystal** | `#7da3c4` | `125, 163, 196` | `[0.49, 0.64, 0.77]` | Main Crystal Foliage Blades, 2D QR Midtone Blue |
| **③** | **Crystal Ice Blue** | `#a3cae8` | `163, 202, 232` | `[0.64, 0.79, 0.91]` | Sunlit Ice Crystals, Frosted Grass Blades |
| **④** | **Pure Snow White** | `#f4f8fc` | `244, 248, 252` | `[0.96, 0.97, 0.99]` | 3D Snow Crystals (飄雪), Frosted Canopy Highlights |
| **⑤** | **Winter Sky Canvas** | `#f5f7fb` | `245, 247, 251` | `[0.961, 0.969, 0.984]` | Sky bottom and 2D light QR modules |
| **⑥** | **Frost Stone Floor Light (3D)** | `#d4d4d1` | `212, 212, 209` | `[0.831, 0.831, 0.820]` | Display-sRGB 3D courtyard light pavers |
| **⑦** | **Frost Stone Floor Shadow (3D)** | `#bfbfbc` | `191, 191, 188` | `[0.749, 0.749, 0.737]` | Display-sRGB 3D courtyard dark pavers before they turn into QR modules |

---

## Implementation reference points in code

1. [`packages/designqr/src/designs/tree/themes.ts`](../../packages/designqr/src/designs/tree/themes.ts): complete immutable preset objects, custom-theme composition, and renderer role resolution.
2. [`src/editor/theme-presets.ts`](../../src/editor/theme-presets.ts): UI preset selection identifiers, names, and labels.
3. [`packages/designqr/src/renderer/webgl/ThreeFallbackRenderer.ts`](../../packages/designqr/src/renderer/webgl/ThreeFallbackRenderer.ts):
   - `getFoliageHarmonicColor()`: Per-instance multi-tone canopy coloring.
   - `getGroundFeatureColor()`: 3D procedural grass and pixel-decor coloring.
   - `getGroundTileColorWithProgress()`: 3D stone terrace transition into the shared multi-tone QR distributions.
   - `createLogoVisual()`: direct, frame-free optional-logo image plane.
4. [`packages/designqr/src/renderer/PresentationSurface.ts`](../../packages/designqr/src/renderer/PresentationSurface.ts) paints the resolved title color and package-owned content, border, and highlight roles onto the live WYSIWYG surface.


## Shibuya city — Blue morning

Shibuya uses **青の朝**, a morning direction inspired by the supplied
`plan/color/blue_period-1.jpg` reference and the user's three proposed blue
swatches. These are the chosen product colors, not an official manga palette.
The three blues were added to the global allowlist at the user's request.
The runtime sources are [`BLUE_MORNING_SWATCHES` and `SHIBUYA_PALETTE`](../../packages/designqr/src/designs/city/palette.ts).
The existing cool white blends with mist blue for scan paper; existing gold and coral remain
small accents. Tree's four seasonal presets retain their own color contracts.

| Swatch | Hex | RGB (0–255) | Normalized RGB (0–1) | Component mapping |
| --- | --- | --- | --- | --- |
| 主色 · Morning blue | `#4A7FA7` | `74, 127, 167` | `[0.290, 0.498, 0.655]` | Glazing, midtone architecture, transit stripes, signs and commuter coats |
| 陰影 · Deep blue | `#29445F` | `41, 68, 95` | `[0.161, 0.267, 0.373]` | Recesses, plinth, structural shadows, QR finder/core ink, title, content and border |
| 晨光 · Mist blue | `#A9CDD9` | `169, 205, 217` | `[0.663, 0.804, 0.851]` | Stage atmosphere, reflected light, upper glazing bands and cool highlights |
| 冷白 · Cool white | `#F5FAFF` | `245, 250, 255` | `[0.961, 0.980, 1.000]` | Source for mist scan paper and optional Border card; small lettering and border highlights |
| Gold accent | `#EED883` | `238, 216, 131` | `[0.933, 0.847, 0.514]` | Amber signals, lamps, tactile paving, one taxi and selected small sign accents |
| Coral accent | `#EA6157` | `234, 97, 87` | `[0.918, 0.380, 0.341]` | Stop signals, regulatory marks, cones, a vehicle and selected sign accents |

### Material roles and composition

The Mark City connecting passage uses `glass`/`glassLight` for opaque stylized
window panes, `coolLight` for reflection bands, `stone`/`concrete` for fascia,
mullions and piers, and `roof` for its shaded soffit. These existing roles keep
the elevated passage in the same morning palette as the station.

The station-side worksite uses `stone`/`concrete` for hoarding, scaffold tubes
and cabin panels, `blue` for the lower fence stripe and excavator body, `roof`
for reinforcement and tracks, and `asphaltLight` for the aggregate base.
`glass`/`glassLight` shade windows and gate panels; restrained `warmLight`
accents mark fence caps and the excavator boom. Work notices use the existing
lightbox palette.

The station-curb L-shaped and square gardens use `roof` for retaining walls, `concrete` for
coping, `foliage` for shrubs and tree crowns, `foliageHighlight` for lit leaves,
and small `coolLight`/`warmLight` blooms. Soil blends `foliage` toward `roof`.

`mix(A, B, t)` below means sRGB inputs decoded to linear light, blended by `t`
toward B, and encoded back to sRGB by `mixCityColor()`. These are derived colors,
not additional authored bases. The table uses the swatch names above.

| Runtime role | Source or derivation | Use |
| --- | --- | --- |
| `glass`, `blue`, `transitStripe`, `signalGo` | Morning blue | Glazing and blue city details |
| `glassLight` | mix(Morning blue, Mist blue, .36) | Glass reflections and slab bands |
| `concrete` | mix(Morning blue, Mist blue, .62) | Soft gray-blue walls, mullions and metal |
| `stone` | mix(Mist blue, Cool white, .26) | Stone, pale signs, curbs and vehicle paint |
| `roof` | mix(Deep blue, Morning blue, .15) | Roofs and structural equipment |
| `asphalt` | mix(Deep blue, Morning blue, .22) | Dark road foundation |
| `asphaltLight` | mix(Deep blue, Mist blue, .18) | Soft crossing reflection |
| `pavement` | mix(Morning blue, Mist blue, .82) | Open pavement and station square |
| `roadPaint`, `windowLight` | mix(Mist blue, Cool white, .40) | Restrained crossing, guide, narrowing-hatch and stopping-bay paint; cool shopfront/window light |
| `roadAccent` | mix(Deep blue, Morning blue, .48) | Reference lane surfaces and the short curbside stopping patch outside the east road's outbound edge line |
| `roadEdge` | mix(Mist blue, Gold accent, .22) | Thin muted curb accents |
| `foliage` | mix(Morning blue, Deep blue, .25) | Blue street-tree canopies |
| `foliageHighlight` | mix(Morning blue, Mist blue, .45) | Soft foliage highlights |
| `ink`, `paper`, `coolLight`, `warmLight`, `coral` | Deep blue, Cool white, Mist blue, Gold accent, Coral accent respectively | Shared material and presentation roles |
| `sky`, `dusk` | Mist blue; mix(Mist blue, Cool white, .70) | Cool atmosphere fading toward a pale horizon |
| `qrBlue` | mix(Deep blue, Morning blue, .72) | Main blue data-cell ink |
| `qrSlate` | mix(Deep blue, Mist blue, .12) | Cool reflected data-cell ink |
| `qrWarm` | mix(Deep blue, mix(Gold accent, Coral accent, .55), .14) | Sparse warm-gray data-cell reflections |
| `qrPaper` | mix(Mist blue, Cool white, .82) | Light QR cells, transparent matrix fill and enabled Border card |

Blue architecture frames a softly lit crossing. The road's color transitions
from `asphalt` at the approaches toward `asphaltLight` near the survey origin,
using an exponential falloff with radius .17 in tile coordinates. The reflection is
evaluated per pixel so overlapping survey polygons agree without interpolation
stripes. A carriageway-only depth offset separates the road and its paint from
the underlying plinth; pavement keeps its original depth relationship with low
garden details. Geographic boundaries, triangulation, height, stair wells, markings and
traffic paths remain unchanged. Lane surfaces use
`roadAccent`; signs and signals retain their independent coral role. Crossing
paint is a mist/white blend rather than the full scan-paper highlight.

QFRONT retains distinct glazing/reflection bands, blue-shadow roofs and cooler
mullions. Contextual windows reserve gold for the top 3% of the deterministic
window sampler; the other formerly warm windows and shopfronts use `windowLight`.
The imported landmark gold slot maps to cool window light. Content-derived landmark
reflection bands choose among `glass`, `glassLight`, `coolLight`, and `windowLight`
without changing structural materials or the shared asset templates. Street-tree crowns
are blue throughout. Commuter coats use an eight-cool/two-warm repeating set;
the fleet keeps one gold taxi and one coral sedan among cool vehicles.

Fourteen original sign designs retain their six compositions and all existing
lettering, aspect ratios, logo anchoring and restore behavior. Large backgrounds
use blue, deep blue, concrete or pale stone. Gold/coral appear in selected small
accents rather than whole sign backgrounds. The main QFRONT sign has deep-blue
backing, stone lettering, a glass-light motif and blue ticker. Uploaded logos
retain their original runtime colors.

Station, police box, subway entrances, railway and Hachikō continue to consume
the shared semantic palette. Balcony/subway glass retain 38%/28% base opacity.
Hachikō's bronze-like shading now derives from blue roof/shadow roles with the
existing small gold light response. JR bridge lettering retains its existing
linear blue-times-gold blend with 12% glass-light interpolation. All source
geometry, lettering and placement remain governed by their owning documents.

### Imported materials and color space

The existing GLB retains its original nine Osaka authoring swatches and twelve
named material slots. It contains no textures or stored vertex colors. Those
source swatches are validated against the manifest, not used as runtime paint.
The loader retains material-role indices, normal-derived face-light weights and
the vehicle paint mask in theme-neutral CPU templates. A landmark's generic
blue source slot is resolved to the glass role. `createCityAssetGeometry()`
clones a template and applies the semantic palette per player, then emits linear
vertex colors. Concurrent instances cannot recolor one another or the cache.
Vehicle paint only affects tagged body panels; glazing, lamps and wheels retain
their own roles. Current public City configuration still accepts only Shibuya;
this internal separation is a basis for future themes, not a new custom-theme API.

`SHIBUYA_ASSET_SOURCE_PALETTE` keeps landmark authoring/regeneration compatible
with the original material slots. Geometry need not be re-exported for this
runtime palette change. Source GLB colors and runtime colors have separate tests.
Rendering uses unlit materials with baked face illumination; Blender roughness
and PBR lighting do not control the product appearance. Hex inputs decode once
to Linear-sRGB; vertex colors and morph interpolation remain linear; WebGL and
PNG output use sRGB with no tone mapping on the scan face.

### Layered 2D inks and Border-owned margin

The 2D artwork uses four flat, opaque inks: `ink`, `qrBlue`, `qrSlate` and
`qrWarm`, against light `qrPaper` cells. All three finder patterns keep exact
Deep blue `#29445F`. Data cells use deterministic 2-column × 3-row color groups,
a broad diagonal light band and bounded cell variation to evoke facade panels.
The palette stops are .26/.73/.95; warm reflections remain sparse. The selector
in [`qr-colors.ts`](../../packages/designqr/src/designs/city/qr-colors.ts) uses
cell coordinates, not animation time, Logo or Border state. It changes only
which approved derived ink fills each existing dark cell.

The four inks have calculated relative-luminance contrast of approximately
8.96:1, 4.57:1, 5.60:1 and 5.82:1 respectively against mist paper. These are
palette checks, not a decoding guarantee. Each module keeps one exact color;
Tree's brightness lift and retained 3D shading do not alter the endpoint.
The original QR matrix remains unchanged. Logo mode retains high error
correction and the existing bounded, frame-free uploaded image; every other
sampled cell follows the same ink selection.

**Only an enabled Border fills the four-module margin.** With Border disabled,
the local paper stops exactly at the QR matrix: opaque output reveals the
atmosphere outside it, and transparent output leaves those pixels clear.
The four-module metadata anchor still exists geometrically, so toggling Border
does not move the QR, title or value. Hosts own any scanning backdrop outside
borderless transparent artwork.

Enabling Border fills the margin and details card with `qrPaper`. City reserves a
minimum four-pixel decorative inset and bounds corner radius by that inset to
keep the complete square margin filled even at zero requested padding.
Border strokes and blurred shadows are clipped out of the protected quiet zone.
Title/value anchoring remains outside the shared four-module boundary.

The transparent matrix or enabled card fill fades in during the final 18% of the established morph, and reduced
motion commits directly to the exact endpoint. Buildings, road surfaces and
paint, pavement, signs, street/station details and visible actors pass their
source colors to morph tiles. These retain their city colors early in the turn,
then continuously acquire their destination's scan ink or mist paper over
50–94% of progress. Detailed city surfaces remain opaque until tile coverage
is established; the short handoff preserves the existing glass base opacities.
Building sections blend into their existing palette-colored blocks from upper
storeys downward over 8–42%, with the original solid city underneath. This is
an opacity-only reveal: no new colors, earlier scan-paper grade, or translucent
whole-building fade is introduced. Street/detail reveal and the 50–94% scan-color
interpolation retain their existing timing.
Thin crosswalk fragments use `roadPaint`, with asphalt base tiles beneath them
rather than prematurely widening stripe samples into light squares. Dark
asphalt supplies both dark and light destinations, so light areas form as
individual tiles instead of a uniform road-color replacement. The canonical
WebGL ink/paper layer takes over only in the final 6% of morph progress, keeping
opaque tile coverage underneath until it is complete; the
existing presentation-card fade and Border-owned margin remain unchanged.
City geometry is absent at the endpoint. Editor, React, iframe and exported PNG
share the same color and margin behavior.

The QFRONT vision panel and MAGNET corner/side posters borrow their existing
on-palette textures on six folding half-panels. Their unmodified artwork fades
over 58–78% to reveal the colored tiles beneath it; no extra color grade or
texture-to-ink shader changes the sign colors. Their original UV proportions
survive while any lettering remains visible. The QFRONT map reflects the current
Logo state: cleared background/ticker when branded, original lettering when
removed. Uploaded logo pixels remain on the independent logo plane with their
original colors and alpha; they are never sampled into morph inks or restricted
to the authored city palette. Neither texture artwork nor its geometry is drawn
over the completed QR.

City's title, content, border and focus use deep blue; border highlight and focus
contrast use cool white. Border/highlight opacities remain approximately 25%/45%.
Internal presentation defaults remain below host CSS overrides. Editor interface
tokens and user-uploaded image colors are outside this artwork palette change.
