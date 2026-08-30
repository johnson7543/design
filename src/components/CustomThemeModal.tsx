import React, { useState } from 'react';
import {
  X,
  Palette,
  Sparkles,
  Leaf,
  Snowflake,
} from 'lucide-react';
import type { TreeShapeStyle } from 'designqr/editor';
import type { CustomTheme } from '../editor/types';

interface CustomThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTheme?: CustomTheme | null;
  onSaveTheme: (theme: CustomTheme) => void;
  onDeleteTheme?: (themeId: string) => void;
  onPreview?: (theme: CustomTheme) => void;
}

interface MultiFoliagePreset {
  emoji: string;
  name: string;
  main: string;
  highlight: string;
  shadow: string;
  midtone: string;
}

const MULTI_FOLIAGE_PRESETS: MultiFoliagePreset[] = [
  { emoji: '🌸', name: 'Spring Sakura (春・花衣與吉野櫻)', main: '#F4B4CF', highlight: '#FCEEF5', shadow: '#D98EAF', midtone: '#F8D2E3' },
  { emoji: '☀️', name: 'Summer Bamboo (033 立夏・翠玉與若苗)', main: '#02983B', highlight: '#99CC81', shadow: '#00785E', midtone: '#00AC7A' },
  { emoji: '🍂', name: 'Autumn Maple (京都清水寺・紅葉與楓橘)', main: '#E2451E', highlight: '#F4A358', shadow: '#BD3528', midtone: '#E77433' },
  { emoji: '❄️', name: 'Winter Frost (冬・冰晶雪景)', main: '#D8E5F0', highlight: '#F4F8FC', shadow: '#577A9E', midtone: '#A3CAE8' },
];

interface MultiGroundPreset {
  emoji: string;
  name: string;
  base: string;
  shadow: string;
}

const MULTI_GROUND_PRESETS: MultiGroundPreset[] = [
  { emoji: '🌸', name: 'Spring Peach & Plum (028 春分・色音與終日石板)', base: '#F0CCBD', shadow: '#C38F95' },
  { emoji: '☀️', name: 'Summer Sunlight & Slate (033 立夏・花水木與素鼠石板)', base: '#F6F4D7', shadow: '#8A987C' },
  { emoji: '🍂', name: 'Autumn Hatsuyuki & Cypress (秋・初雪與檜舞台石板)', base: '#F8F0EC', shadow: '#C6AE8D' },
  { emoji: '❄️', name: 'Winter Snow & Frost Stone (冬・冰白與霜石地板)', base: '#F5F7FA', shadow: '#9AA6B3' },
];

interface MultiGrassPreset {
  emoji: string;
  name: string;
  lawn: string;
  tip: string;
  eye: string;
}

const MULTI_GRASS_PRESETS: MultiGrassPreset[] = [
  { emoji: '🌸', name: 'Spring Meadow (春・若草色、萌黃與常盤綠)', lawn: '#85B667', tip: '#BFD47B', eye: '#286018' },
  { emoji: '☀️', name: 'Summer Sprout (033 立夏・若苗色、嬰兒與翠玉)', lawn: '#99CC81', tip: '#D7DE8A', eye: '#02983B' },
  { emoji: '🍂', name: 'Autumn Grass (秋・冬草、酒林與山眠)', lawn: '#9D8C73', tip: '#BD956E', eye: '#5D4C35' },
  { emoji: '❄️', name: 'Winter Snow (冬・純白雪、冰晶藍與深霜石)', lawn: '#FFFFFF', tip: '#A3CAE8', eye: '#305E88' },
];

export const CustomThemeModal: React.FC<CustomThemeModalProps> = ({
  isOpen,
  onClose,
  initialTheme,
  onSaveTheme,
  onPreview,
}) => {
  const [label, setLabel] = useState(initialTheme?.label ?? 'Custom Theme');

  // Foliage Multi-Colors (4 Harmonic Tones)
  const [foliageColor, setFoliageColor] = useState(initialTheme?.foliageColor ?? '#02983B');
  const [foliageHighlightColor, setFoliageHighlightColor] = useState(initialTheme?.foliageHighlightColor ?? '#99CC81');
  const [foliageShadowColor, setFoliageShadowColor] = useState(initialTheme?.foliageShadowColor ?? '#00785E');
  const [foliageMidtoneColor, setFoliageMidtoneColor] = useState(initialTheme?.foliageMidtoneColor ?? '#00AC7A');

  const [foliageShape, setFoliageShape] = useState<'blossom' | 'leaf'>(initialTheme?.foliageShape ?? 'leaf');
  const [treeShape, setTreeShape] = useState<TreeShapeStyle>(initialTheme?.treeShape ?? 'dome');
  const [canopyDensity, setCanopyDensity] = useState<number>(initialTheme?.canopyDensity ?? 100);

  // Ground Multi-Colors (Canvas Base & Stone Paver Shadow)
  const [groundColor, setGroundColor] = useState(initialTheme?.groundColor ?? '#F6F4D7');
  const [groundShadowColor, setGroundShadowColor] = useState(initialTheme?.groundShadowColor ?? '#8A987C');

  // Grass / Ground Decor Multi-Colors (Lawn Body, Sprout Tip, QR Center Eye Anchor)
  const [groundFeature, setGroundFeature] = useState<'grass' | 'snow' | 'none'>(initialTheme?.groundFeature ?? 'grass');
  const [groundFeatureColor, setGroundFeatureColor] = useState<string>(initialTheme?.groundFeatureColor ?? '#99CC81');
  const [groundFeatureHighlightColor, setGroundFeatureHighlightColor] = useState<string>(initialTheme?.groundFeatureHighlightColor ?? '#D7DE8A');
  const [groundFeatureShadowColor, setGroundFeatureShadowColor] = useState<string>(initialTheme?.groundFeatureShadowColor ?? '#02983B');

  // Sky Atmosphere Gradient
  const [skyTop, setSkyTop] = useState(initialTheme?.skyTop ?? '#F6F4D7');
  const [skyBottom, setSkyBottom] = useState(initialTheme?.skyBottom ?? '#D7DE8A');

  // Particles
  const [particleType, setParticleType] = useState<'sakura' | 'leaf' | 'fireflies' | 'snow' | 'none'>(initialTheme?.particleType ?? 'fireflies');
  const [particleAmount, setParticleAmount] = useState<number>(initialTheme?.particleAmount ?? 16);
  const groundLeavesAmount = initialTheme?.groundLeavesAmount ?? 44;

  // Build a preview theme from current state
  const buildPreviewTheme = (overrides?: Partial<CustomTheme>): CustomTheme => ({
    id: initialTheme && initialTheme.id ? initialTheme.id : '__preview__',
    label: label.trim() || 'Custom Theme',
    isCustom: true,
    foliageColor,
    foliageHighlightColor,
    foliageShadowColor,
    foliageMidtoneColor,
    foliageShape,
    treeShape,
    canopyDensity,
    groundColor,
    groundShadowColor,
    groundFeature,
    groundFeatureColor: groundFeature !== 'none' ? groundFeatureColor : undefined,
    groundFeatureHighlightColor: groundFeature !== 'none' ? groundFeatureHighlightColor : undefined,
    groundFeatureShadowColor: groundFeature !== 'none' ? groundFeatureShadowColor : undefined,
    skyTop,
    skyBottom,
    particleType,
    particleAmount,
    groundLeavesAmount,
    ...overrides,
  });

  // Fire live preview on any visual change
  const previewWith = (overrides?: Partial<CustomTheme>) => {
    if (onPreview) {
      onPreview(buildPreviewTheme(overrides));
    }
  };

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveTheme(buildPreviewTheme({
      id: initialTheme && initialTheme.id ? initialTheme.id : `custom-${Date.now()}`,
    }));
    onClose();
  };

  // Wrapped setters that also fire preview
  const updateFoliageMain = (hex: string) => { setFoliageColor(hex); previewWith({ foliageColor: hex }); };
  const updateFoliageHighlight = (hex: string) => { setFoliageHighlightColor(hex); previewWith({ foliageHighlightColor: hex }); };
  const updateFoliageShadow = (hex: string) => { setFoliageShadowColor(hex); previewWith({ foliageShadowColor: hex }); };
  const updateFoliageMidtone = (hex: string) => { setFoliageMidtoneColor(hex); previewWith({ foliageMidtoneColor: hex }); };

  const applyFoliagePreset = (p: MultiFoliagePreset) => {
    setFoliageColor(p.main);
    setFoliageHighlightColor(p.highlight);
    setFoliageShadowColor(p.shadow);
    setFoliageMidtoneColor(p.midtone);
    previewWith({
      foliageColor: p.main,
      foliageHighlightColor: p.highlight,
      foliageShadowColor: p.shadow,
      foliageMidtoneColor: p.midtone,
    });
  };

  const updateGroundBase = (hex: string) => { setGroundColor(hex); previewWith({ groundColor: hex }); };
  const updateGroundShadow = (hex: string) => { setGroundShadowColor(hex); previewWith({ groundShadowColor: hex }); };

  const applyGroundPreset = (p: MultiGroundPreset) => {
    setGroundColor(p.base);
    setGroundShadowColor(p.shadow);
    previewWith({ groundColor: p.base, groundShadowColor: p.shadow });
  };

  const updateGrassLawn = (hex: string) => { setGroundFeatureColor(hex); previewWith({ groundFeatureColor: hex }); };
  const updateGrassTip = (hex: string) => { setGroundFeatureHighlightColor(hex); previewWith({ groundFeatureHighlightColor: hex }); };
  const updateGrassEye = (hex: string) => { setGroundFeatureShadowColor(hex); previewWith({ groundFeatureShadowColor: hex }); };

  const applyGrassPreset = (p: MultiGrassPreset) => {
    setGroundFeatureColor(p.lawn);
    setGroundFeatureHighlightColor(p.tip);
    setGroundFeatureShadowColor(p.eye);
    previewWith({
      groundFeatureColor: p.lawn,
      groundFeatureHighlightColor: p.tip,
      groundFeatureShadowColor: p.eye,
    });
  };

  const updateFoliageShape = (shape: 'blossom' | 'leaf') => { setFoliageShape(shape); previewWith({ foliageShape: shape }); };
  const updateTreeShape = (shape: TreeShapeStyle) => { setTreeShape(shape); previewWith({ treeShape: shape }); };
  const updateCanopyDensity = (density: number) => { setCanopyDensity(density); previewWith({ canopyDensity: density }); };
  const updateGroundFeature = (feat: CustomTheme['groundFeature']) => {
    const nextFeat = feat || 'grass';
    setGroundFeature(nextFeat);
    let nextCol = groundFeatureColor;
    if (nextFeat === 'snow' && (groundFeatureColor === '#99CC81' || groundFeatureColor === '#85B667')) {
      nextCol = '#FFFFFF';
      setGroundFeatureColor('#FFFFFF');
    } else if (nextFeat === 'grass' && groundFeatureColor === '#FFFFFF') {
      nextCol = '#99CC81';
      setGroundFeatureColor('#99CC81');
    }
    previewWith({ groundFeature: nextFeat, groundFeatureColor: nextCol });
  };

  const updateSkyTop = (hex: string) => { setSkyTop(hex); previewWith({ skyTop: hex }); };
  const updateSkyBottom = (hex: string) => { setSkyBottom(hex); previewWith({ skyBottom: hex }); };
  const updateParticle = (p: CustomTheme['particleType']) => { setParticleType(p); previewWith({ particleType: p }); };
  const updateParticleAmount = (amount: number) => { setParticleAmount(amount); previewWith({ particleAmount: amount }); };

  return (
    <div className="custom-theme-aside-overlay">
      <aside
        className="custom-theme-aside-panel glass-panel"
        role="dialog"
        aria-labelledby="custom-theme-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Palette size={18} className="modal-title-icon" />
            <h3 className="modal-title" id="custom-theme-title">
              {initialTheme && initialTheme.id ? 'Edit Theme' : 'New Theme'}
            </h3>
          </div>

          <div className="modal-header-actions">
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="theme-form aside-theme-form">
          {/* Live Preview Card */}
          <div
            className="theme-live-preview-card"
            style={{
              background: `radial-gradient(circle at 50% 30%, ${skyTop} 0%, ${skyBottom} 100%)`,
            }}
          >
            <div className="preview-decor-tree">
              <div
                className="preview-tree-crown"
                style={{
                  background: `radial-gradient(circle at 35% 30%, ${foliageHighlightColor} 0%, ${foliageColor} 55%, ${foliageShadowColor} 100%)`,
                }}
              />
              <div
                className="preview-ground-platform"
                style={{ backgroundColor: groundColor }}
              />
            </div>
            <div className="preview-info-pill">
              <span className="preview-label">{label || 'Custom Theme'}</span>
              <span className="preview-particle-badge">
                {(particleType === 'leaf' || particleType === 'sakura') && `Leaves (${particleAmount})`}
                {particleType === 'fireflies' && 'Fireflies'}
                {particleType === 'snow' && 'Snow'}
                {particleType === 'none' && 'None'}
              </span>
            </div>
          </div>

          {/* Theme Name */}
          <div className="form-group">
            <label className="form-label">Theme Name</label>
            <input
              type="text"
              className="theme-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Summer Bamboo"
              maxLength={24}
              required
            />
          </div>

          {/* 1. Tree Foliage Multi-Color Section (4 Harmonic Tones) */}
          <div className="form-group">
            <div className="form-label-row">
              <label className="form-label">Tree Foliage Colors (4 Tones)</label>
            </div>

            {/* 4-Color Multi Tone Grid */}
            <div className="multi-color-tones-grid">
              <div className="tone-color-item">
                <span className="tone-label">Main Body (主色)</span>
                <div className="color-value-badge">
                  <input
                    type="color"
                    className="inline-color-picker"
                    value={foliageColor}
                    onChange={(e) => updateFoliageMain(e.target.value)}
                  />
                  <span className="color-hex-text">{foliageColor.toUpperCase()}</span>
                </div>
              </div>

              <div className="tone-color-item">
                <span className="tone-label">Highlight (葉尖)</span>
                <div className="color-value-badge">
                  <input
                    type="color"
                    className="inline-color-picker"
                    value={foliageHighlightColor}
                    onChange={(e) => updateFoliageHighlight(e.target.value)}
                  />
                  <span className="color-hex-text">{foliageHighlightColor.toUpperCase()}</span>
                </div>
              </div>

              <div className="tone-color-item">
                <span className="tone-label">Shadow (陰影)</span>
                <div className="color-value-badge">
                  <input
                    type="color"
                    className="inline-color-picker"
                    value={foliageShadowColor}
                    onChange={(e) => updateFoliageShadow(e.target.value)}
                  />
                  <span className="color-hex-text">{foliageShadowColor.toUpperCase()}</span>
                </div>
              </div>

              <div className="tone-color-item">
                <span className="tone-label">Midtone (中階)</span>
                <div className="color-value-badge">
                  <input
                    type="color"
                    className="inline-color-picker"
                    value={foliageMidtoneColor}
                    onChange={(e) => updateFoliageMidtone(e.target.value)}
                  />
                  <span className="color-hex-text">{foliageMidtoneColor.toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* Quick Multi-Foliage Presets */}
            <div className="preset-palette-chip-grid">
              {MULTI_FOLIAGE_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className={`preset-palette-pill ${foliageColor.toLowerCase() === p.main.toLowerCase() ? 'active' : ''}`}
                  onClick={() => applyFoliagePreset(p)}
                  title={p.name}
                  aria-label={p.name}
                >
                  <span className="preset-emoji">{p.emoji}</span>
                  <span
                    className="palette-preview-dot"
                    style={{
                      background: `linear-gradient(135deg, ${p.highlight} 0%, ${p.main} 50%, ${p.shadow} 100%)`,
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Tree Canopy Foliage Density Slider */}
          <div className="form-group">
            <div className="form-label-row">
              <label className="form-label">Foliage Density</label>
              <span className="slider-val-pill">{canopyDensity}%</span>
            </div>
            <div className="particle-slider-card density-control-card">
              <div className="slider-track-wrap">
                <span className="slider-bound-label">Sparse (20%)</span>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={canopyDensity}
                  onChange={(e) => updateCanopyDensity(Number(e.target.value))}
                  className="leaf-amount-slider"
                />
                <span className="slider-bound-label">Lush (100%)</span>
              </div>
            </div>
          </div>

          {/* Tree Foliage Shape */}
          <div className="form-group">
            <label className="form-label">Tree Foliage Shape</label>
            <div className="particle-selector-grid option-grid-2">
              <button
                type="button"
                className={`particle-option-btn ${foliageShape === 'blossom' ? 'active' : ''}`}
                onClick={() => updateFoliageShape('blossom')}
              >
                <span className="particle-option-symbol">🌸</span>
                <span>Blossom</span>
              </button>
              <button
                type="button"
                className={`particle-option-btn ${foliageShape === 'leaf' ? 'active' : ''}`}
                onClick={() => updateFoliageShape('leaf')}
              >
                <span className="particle-option-symbol">🍃</span>
                <span>Leaf</span>
              </button>
            </div>
          </div>

          {/* Tree Silhouette / Shape Style */}
          <div className="form-group">
            <label className="form-label">Tree Shape</label>
            <div className="particle-selector-grid option-grid-3">
              <button
                type="button"
                className={`particle-option-btn ${treeShape === 'dome' ? 'active' : ''}`}
                onClick={() => updateTreeShape('dome')}
                title="Dome (Classic balanced crown)"
              >
                <span className="particle-option-symbol">🌳</span>
                <span>Dome</span>
              </button>
              <button
                type="button"
                className={`particle-option-btn ${treeShape === 'wide' ? 'active' : ''}`}
                onClick={() => updateTreeShape('wide')}
                title="Wide (Broader round canopy, same height)"
              >
                <span className="particle-option-symbol">🌿</span>
                <span>Wide</span>
              </button>
              <button
                type="button"
                className={`particle-option-btn ${treeShape === 'pine' ? 'active' : ''}`}
                onClick={() => updateTreeShape('pine')}
                title="Pine (Pointed conical shape)"
              >
                <span className="particle-option-symbol">🌲</span>
                <span>Pine</span>
              </button>
            </div>
          </div>

          {/* 2. Ground & Paver Colors Section (2 Tones) */}
          <div className="form-group">
            <div className="form-label-row">
              <label className="form-label">Ground & Stone Paver Colors (2 Tones)</label>
            </div>
            <div className="multi-color-tones-grid">
              <div className="tone-color-item">
                <span className="tone-label">Canvas Base (淺色底)</span>
                <div className="color-value-badge">
                  <input
                    type="color"
                    className="inline-color-picker"
                    value={groundColor}
                    onChange={(e) => updateGroundBase(e.target.value)}
                  />
                  <span className="color-hex-text">{groundColor.toUpperCase()}</span>
                </div>
              </div>

              <div className="tone-color-item">
                <span className="tone-label">Stone Shadow (石板暗階)</span>
                <div className="color-value-badge">
                  <input
                    type="color"
                    className="inline-color-picker"
                    value={groundShadowColor}
                    onChange={(e) => updateGroundShadow(e.target.value)}
                  />
                  <span className="color-hex-text">{groundShadowColor.toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* Quick Ground Presets (Emoji + Color Dot Only) */}
            <div className="preset-palette-chip-grid">
              {MULTI_GROUND_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className={`preset-palette-pill ${groundColor.toLowerCase() === p.base.toLowerCase() ? 'active' : ''}`}
                  onClick={() => applyGroundPreset(p)}
                  title={p.name}
                  aria-label={p.name}
                >
                  <span className="preset-emoji">{p.emoji}</span>
                  <span
                    className="palette-preview-dot"
                    style={{
                      background: `linear-gradient(135deg, ${p.base} 0%, ${p.shadow} 100%)`,
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* 3. Grass & Lawn Multi-Color Section (3 Tones) */}
          <div className="form-group">
            <label className="form-label">Ground Surface Decor</label>
            <div className="particle-selector-grid option-grid-3">
              <button
                type="button"
                className={`particle-option-btn ${groundFeature === 'grass' ? 'active' : ''}`}
                onClick={() => updateGroundFeature('grass')}
              >
                <Leaf size={16} />
                <span>Grass</span>
              </button>

              <button
                type="button"
                className={`particle-option-btn ${groundFeature === 'snow' ? 'active' : ''}`}
                onClick={() => updateGroundFeature('snow')}
              >
                <Snowflake size={16} />
                <span>Snow</span>
              </button>

              <button
                type="button"
                className={`particle-option-btn ${groundFeature === 'none' ? 'active' : ''}`}
                onClick={() => updateGroundFeature('none')}
              >
                <Sparkles size={16} />
                <span>None</span>
              </button>
            </div>

            {/* Ground Feature Color Customization (3 Tones for Grass) */}
            {groundFeature !== 'none' && (
              <div className="particle-slider-card nested-form-card">
                <div className="form-label-row nested-form-heading">
                  <label className="form-label">
                    {groundFeature === 'snow' ? 'Snow Palette' : 'Lawn & Finder Colors (3 Tones)'}
                  </label>
                </div>

                <div className="multi-color-tones-grid tone-grid-3">
                  <div className="tone-color-item">
                    <span className="tone-label">Lawn (草地主色)</span>
                    <div className="color-value-badge">
                      <input
                        type="color"
                        className="inline-color-picker"
                        value={groundFeatureColor}
                        onChange={(e) => updateGrassLawn(e.target.value)}
                      />
                      <span className="color-hex-text">{groundFeatureColor.toUpperCase()}</span>
                    </div>
                  </div>

                  <div className="tone-color-item">
                    <span className="tone-label">Tip (草尖高光)</span>
                    <div className="color-value-badge">
                      <input
                        type="color"
                        className="inline-color-picker"
                        value={groundFeatureHighlightColor}
                        onChange={(e) => updateGrassTip(e.target.value)}
                      />
                      <span className="color-hex-text">{groundFeatureHighlightColor.toUpperCase()}</span>
                    </div>
                  </div>

                  <div className="tone-color-item">
                    <span className="tone-label">QR Eye (碼眼暗核)</span>
                    <div className="color-value-badge">
                      <input
                        type="color"
                        className="inline-color-picker"
                        value={groundFeatureShadowColor}
                        onChange={(e) => updateGrassEye(e.target.value)}
                      />
                      <span className="color-hex-text">{groundFeatureShadowColor.toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Grass Presets (Emoji + Color Dot Only) */}
                <div className="preset-palette-chip-grid">
                  {MULTI_GRASS_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      className={`preset-palette-pill ${groundFeatureColor.toLowerCase() === p.lawn.toLowerCase() ? 'active' : ''}`}
                      onClick={() => applyGrassPreset(p)}
                      title={p.name}
                      aria-label={p.name}
                    >
                      <span className="preset-emoji">{p.emoji}</span>
                      <span
                        className="palette-preview-dot"
                        style={{
                          background: `linear-gradient(135deg, ${p.tip} 0%, ${p.lawn} 50%, ${p.eye} 100%)`,
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. Sky Atmosphere Gradient (2 Tones) */}
          <div className="form-group">
            <label className="form-label">Sky & Atmosphere Color (2 Tones)</label>
            <div className="sky-gradient-row">
              <div className="sky-color-input-block">
                <span className="sky-label">Zenith Top (天頂)</span>
                <div className="color-value-badge">
                  <input
                    type="color"
                    className="inline-color-picker"
                    value={skyTop}
                    onChange={(e) => updateSkyTop(e.target.value)}
                  />
                  <span className="color-hex-text">{skyTop.toUpperCase()}</span>
                </div>
              </div>

              <div className="sky-color-gradient-preview" style={{ background: `linear-gradient(90deg, ${skyTop}, ${skyBottom})` }} />

              <div className="sky-color-input-block">
                <span className="sky-label">Horizon (地平線)</span>
                <div className="color-value-badge">
                  <input
                    type="color"
                    className="inline-color-picker"
                    value={skyBottom}
                    onChange={(e) => updateSkyBottom(e.target.value)}
                  />
                  <span className="color-hex-text">{skyBottom.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Weather & Particle Effects */}
          <div className="form-group">
            <label className="form-label">Weather & Particles</label>
            <div className="particle-selector-grid">
              <button
                type="button"
                className={`particle-option-btn ${particleType === 'leaf' || particleType === 'sakura' ? 'active' : ''}`}
                onClick={() => updateParticle(foliageShape === 'blossom' ? 'sakura' : 'leaf')}
              >
                <Leaf size={16} />
                <span>Leaves</span>
              </button>

              <button
                type="button"
                className={`particle-option-btn ${particleType === 'fireflies' ? 'active' : ''}`}
                onClick={() => updateParticle('fireflies')}
              >
                <Sparkles size={16} />
                <span>Fireflies</span>
              </button>

              <button
                type="button"
                className={`particle-option-btn ${particleType === 'snow' ? 'active' : ''}`}
                onClick={() => updateParticle('snow')}
              >
                <Snowflake size={16} />
                <span>Snow</span>
              </button>

              <button
                type="button"
                className={`particle-option-btn ${particleType === 'none' ? 'active' : ''}`}
                onClick={() => updateParticle('none')}
              >
                <span className="particle-option-symbol">🚫</span>
                <span>None</span>
              </button>
            </div>

            {/* Particle Intensity Slider if not none */}
            {particleType !== 'none' && (
              <div className="particle-slider-card nested-form-card">
                <div className="form-label-row">
                  <span className="tone-label">Particle Intensity</span>
                  <span className="slider-val-pill">{particleAmount}</span>
                </div>
                <div className="slider-track-wrap slider-track-offset">
                  <span className="slider-bound-label">Subtle (4)</span>
                  <input
                    type="range"
                    min="4"
                    max="60"
                    step="2"
                    value={particleAmount}
                    onChange={(e) => updateParticleAmount(Number(e.target.value))}
                    className="leaf-amount-slider"
                  />
                  <span className="slider-bound-label">Dense (60)</span>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="modal-actions-row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              Save Theme
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
};
