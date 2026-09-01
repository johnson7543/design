import React, { useState } from 'react';
import {
  X,
  Palette,
  Sparkles,
  Leaf,
  Box,
  Snowflake,
} from 'lucide-react';
import {
  createTreeParticleOverrides,
  TREE_THEME_PRESETS,
} from 'designqr';
import {
  type TreeShapeStyle,
} from 'designqr/editor';
import type {
  DesignQRThemePreset,
} from 'designqr/config';
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
  preset: DesignQRThemePreset;
  emoji: string;
  name: string;
  main: string;
  highlight: string;
  shadow: string;
  midtone: string;
}

const SPRING_THEME = TREE_THEME_PRESETS.spring;
const SUMMER_THEME = TREE_THEME_PRESETS.summer;
const AUTUMN_THEME = TREE_THEME_PRESETS.autumn;
const WINTER_THEME = TREE_THEME_PRESETS.winter;

const MULTI_FOLIAGE_PRESETS: MultiFoliagePreset[] = [
  { preset: 'spring', emoji: '🌸', name: 'Spring Sakura', main: SPRING_THEME.foliageColor, highlight: SPRING_THEME.foliageHighlightColor, shadow: SPRING_THEME.foliageShadowColor, midtone: SPRING_THEME.foliageMidtoneColor },
  { preset: 'summer', emoji: '☀️', name: 'Summer Bamboo', main: SUMMER_THEME.foliageColor, highlight: SUMMER_THEME.foliageHighlightColor, shadow: SUMMER_THEME.foliageShadowColor, midtone: SUMMER_THEME.foliageMidtoneColor },
  { preset: 'autumn', emoji: '🍂', name: 'Autumn Maple', main: AUTUMN_THEME.foliageColor, highlight: AUTUMN_THEME.foliageHighlightColor, shadow: AUTUMN_THEME.foliageShadowColor, midtone: AUTUMN_THEME.foliageMidtoneColor },
  { preset: 'winter', emoji: '❄️', name: 'Winter Frost', main: WINTER_THEME.foliageColor, highlight: WINTER_THEME.foliageHighlightColor, shadow: WINTER_THEME.foliageShadowColor, midtone: WINTER_THEME.foliageMidtoneColor },
];

interface MultiGroundPreset {
  preset: DesignQRThemePreset;
  emoji: string;
  name: string;
  base: string;
  shadow: string;
}

const MULTI_GROUND_PRESETS: MultiGroundPreset[] = [
  { preset: 'spring', emoji: '🌸', name: 'Spring Peach & Plum', base: SPRING_THEME.groundColor, shadow: SPRING_THEME.groundShadowColor },
  { preset: 'summer', emoji: '☀️', name: 'Summer Sunlight & Slate', base: SUMMER_THEME.groundColor, shadow: SUMMER_THEME.groundShadowColor },
  { preset: 'autumn', emoji: '🍂', name: 'Autumn Hatsuyuki & Cypress', base: AUTUMN_THEME.groundColor, shadow: AUTUMN_THEME.groundShadowColor },
  { preset: 'winter', emoji: '❄️', name: 'Winter Snow & Frost Stone', base: WINTER_THEME.groundColor, shadow: WINTER_THEME.groundShadowColor },
];

interface MultiGrassPreset {
  preset: DesignQRThemePreset;
  emoji: string;
  name: string;
  lawn: string;
  tip: string;
  eye: string;
}

const MULTI_GRASS_PRESETS: MultiGrassPreset[] = [
  { preset: 'spring', emoji: '🌸', name: 'Spring Meadow', lawn: SPRING_THEME.groundFeatureColor, tip: SPRING_THEME.groundFeatureHighlightColor, eye: SPRING_THEME.groundFeatureShadowColor },
  { preset: 'summer', emoji: '☀️', name: 'Summer Sprout', lawn: SUMMER_THEME.groundFeatureColor, tip: SUMMER_THEME.groundFeatureHighlightColor, eye: SUMMER_THEME.groundFeatureShadowColor },
  { preset: 'autumn', emoji: '🍂', name: 'Autumn Grass', lawn: AUTUMN_THEME.groundFeatureColor, tip: AUTUMN_THEME.groundFeatureHighlightColor, eye: AUTUMN_THEME.groundFeatureShadowColor },
  { preset: 'winter', emoji: '❄️', name: 'Winter Pixel Frost', lawn: WINTER_THEME.groundFeatureColor, tip: WINTER_THEME.groundFeatureHighlightColor, eye: WINTER_THEME.groundFeatureShadowColor },
];

function resolveInitialGroundFeature(
  value: unknown
): NonNullable<CustomTheme['groundFeature']> {
  if (value === 'pixel' || value === 'snow') return 'pixel';
  if (value === 'none') return 'none';
  return 'grass';
}

function resolveInitialParticleIntensity(theme: CustomTheme | null | undefined): number {
  if (!theme) return 16;
  if (theme.particleType === 'fireflies') {
    return theme.ambientParticleAmount ?? theme.particleAmount ?? 12;
  }
  if (theme.particleType === 'snow') {
    return Math.round((theme.snowflakeAmount ?? 300) / 5);
  }
  return theme.particleAmount ?? 16;
}

const DERIVE_FOLIAGE_COLOR_ROLES = {
  foliagePaletteColors: undefined,
  qrFoliageColor: undefined,
  qrFoliageHighlightColor: undefined,
  qrFoliageShadowColor: undefined,
  qrFoliageMidtoneColor: undefined,
  qrFoliagePaletteColors: undefined,
  titleColor: undefined,
} satisfies Partial<CustomTheme>;

const DERIVE_GROUND_COLOR_ROLES = {
  groundSurfaceColor: undefined,
  groundSurfaceShadowColor: undefined,
  pedestalColor: undefined,
} satisfies Partial<CustomTheme>;

const DERIVE_GROUND_FEATURE_COLOR_ROLES = {
  groundFeaturePaletteStartColors: undefined,
  groundFeaturePaletteEndColors: undefined,
  qrFinderColor: undefined,
  qrFinderHighlightColor: undefined,
  qrFinderShadowColor: undefined,
  qrFinderEyeColor: undefined,
  qrFinderPaletteColors: undefined,
} satisfies Partial<CustomTheme>;

function getFoliagePresetRoles(
  preset: DesignQRThemePreset
): Partial<CustomTheme> {
  const theme = TREE_THEME_PRESETS[preset];
  return {
    foliageColor: theme.foliageColor,
    foliageHighlightColor: theme.foliageHighlightColor,
    foliageShadowColor: theme.foliageShadowColor,
    foliageMidtoneColor: theme.foliageMidtoneColor,
    foliagePaletteColors: theme.foliagePaletteColors,
    foliagePaletteStops: theme.foliagePaletteStops,
    foliageColorVariation: theme.foliageColorVariation,
    foliageVerticalLift: theme.foliageVerticalLift,
    qrFoliageColor: theme.qrFoliageColor,
    qrFoliageHighlightColor: theme.qrFoliageHighlightColor,
    qrFoliageShadowColor: theme.qrFoliageShadowColor,
    qrFoliageMidtoneColor: theme.qrFoliageMidtoneColor,
    qrFoliagePaletteColors: theme.qrFoliagePaletteColors,
    qrFoliagePaletteStops: theme.qrFoliagePaletteStops,
    qrFoliageColorVariation: theme.qrFoliageColorVariation,
    blossomCenterColor: theme.blossomCenterColor,
    titleColor: theme.titleColor,
  };
}

function getGroundPresetRoles(
  preset: DesignQRThemePreset
): Partial<CustomTheme> {
  const theme = TREE_THEME_PRESETS[preset];
  return {
    groundColor: theme.groundColor,
    groundShadowColor: theme.groundShadowColor,
    groundSurfaceColor: theme.groundSurfaceColor,
    groundSurfaceShadowColor: theme.groundSurfaceShadowColor,
    groundSurfaceVariation: theme.groundSurfaceVariation,
    groundSurfaceShadowVariation: theme.groundSurfaceShadowVariation,
    pedestalColor: theme.pedestalColor,
  };
}

function getGroundFeaturePresetRoles(
  preset: DesignQRThemePreset
): Partial<CustomTheme> {
  const theme = TREE_THEME_PRESETS[preset];
  return {
    groundFeatureColor: theme.groundFeatureColor,
    groundFeatureHighlightColor: theme.groundFeatureHighlightColor,
    groundFeatureShadowColor: theme.groundFeatureShadowColor,
    groundFeaturePaletteStartColors: theme.groundFeaturePaletteStartColors,
    groundFeaturePaletteEndColors: theme.groundFeaturePaletteEndColors,
    groundFeaturePaletteStops: theme.groundFeaturePaletteStops,
    groundFeaturePaletteVariations: theme.groundFeaturePaletteVariations,
    qrFinderColor: theme.qrFinderColor,
    qrFinderHighlightColor: theme.qrFinderHighlightColor,
    qrFinderShadowColor: theme.qrFinderShadowColor,
    qrFinderEyeColor: theme.qrFinderEyeColor,
    qrFinderPaletteColors: theme.qrFinderPaletteColors,
    qrFinderPaletteStops: theme.qrFinderPaletteStops,
    qrFinderColorVariation: theme.qrFinderColorVariation,
  };
}

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

  const [foliageShape, setFoliageShape] = useState<
    NonNullable<CustomTheme['foliageShape']>
  >(initialTheme?.foliageShape ?? 'leaf');
  const [treeShape, setTreeShape] = useState<TreeShapeStyle>(initialTheme?.treeShape ?? 'dome');
  const [canopyDensity, setCanopyDensity] = useState<number>(initialTheme?.canopyDensity ?? 100);

  // Ground Multi-Colors (Canvas Base & Stone Paver Shadow)
  const [groundColor, setGroundColor] = useState(initialTheme?.groundColor ?? '#F6F4D7');
  const [groundShadowColor, setGroundShadowColor] = useState(initialTheme?.groundShadowColor ?? '#8A987C');

  // Ground Decor Multi-Colors (Grass/Pixel Body, Highlight, QR Center Eye Anchor)
  const [groundFeature, setGroundFeature] = useState<
    NonNullable<CustomTheme['groundFeature']>
  >(resolveInitialGroundFeature(initialTheme?.groundFeature));
  const [groundFeatureColor, setGroundFeatureColor] = useState<string>(initialTheme?.groundFeatureColor ?? '#99CC81');
  const [groundFeatureHighlightColor, setGroundFeatureHighlightColor] = useState<string>(initialTheme?.groundFeatureHighlightColor ?? '#D7DE8A');
  const [groundFeatureShadowColor, setGroundFeatureShadowColor] = useState<string>(initialTheme?.groundFeatureShadowColor ?? '#02983B');

  // Sky Atmosphere Gradient
  const [skyTop, setSkyTop] = useState(initialTheme?.skyTop ?? '#F6F4D7');
  const [skyBottom, setSkyBottom] = useState(initialTheme?.skyBottom ?? '#D7DE8A');

  // Particles
  const [particleType, setParticleType] = useState<'sakura' | 'leaf' | 'fireflies' | 'snow' | 'none'>(initialTheme?.particleType ?? 'fireflies');
  const [particleAmount, setParticleAmount] = useState<number>(
    resolveInitialParticleIntensity(initialTheme)
  );
  const [themeRoleOverrides, setThemeRoleOverrides] = useState<
    Partial<CustomTheme>
  >({});

  // Build a preview theme from current state
  const buildPreviewTheme = (overrides?: Partial<CustomTheme>): CustomTheme => ({
    ...(initialTheme ?? {}),
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
    ...themeRoleOverrides,
    ...overrides,
  });

  // Fire live preview on any visual change
  const previewWith = (overrides?: Partial<CustomTheme>) => {
    if (onPreview) {
      onPreview(buildPreviewTheme(overrides));
    }
  };

  const rememberThemeRoleOverrides = (overrides: Partial<CustomTheme>) => {
    setThemeRoleOverrides((current) => ({ ...current, ...overrides }));
  };

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveTheme(buildPreviewTheme({
      id: initialTheme && initialTheme.id ? initialTheme.id : `custom-${Date.now()}`,
    }));
  };

  // Wrapped setters that also fire preview
  const updateFoliageMain = (hex: string) => {
    setFoliageColor(hex);
    rememberThemeRoleOverrides(DERIVE_FOLIAGE_COLOR_ROLES);
    previewWith({ foliageColor: hex, ...DERIVE_FOLIAGE_COLOR_ROLES });
  };
  const updateFoliageHighlight = (hex: string) => {
    setFoliageHighlightColor(hex);
    rememberThemeRoleOverrides(DERIVE_FOLIAGE_COLOR_ROLES);
    previewWith({ foliageHighlightColor: hex, ...DERIVE_FOLIAGE_COLOR_ROLES });
  };
  const updateFoliageShadow = (hex: string) => {
    setFoliageShadowColor(hex);
    rememberThemeRoleOverrides(DERIVE_FOLIAGE_COLOR_ROLES);
    previewWith({ foliageShadowColor: hex, ...DERIVE_FOLIAGE_COLOR_ROLES });
  };
  const updateFoliageMidtone = (hex: string) => {
    setFoliageMidtoneColor(hex);
    rememberThemeRoleOverrides(DERIVE_FOLIAGE_COLOR_ROLES);
    previewWith({ foliageMidtoneColor: hex, ...DERIVE_FOLIAGE_COLOR_ROLES });
  };

  const applyFoliagePreset = (p: MultiFoliagePreset) => {
    setFoliageColor(p.main);
    setFoliageHighlightColor(p.highlight);
    setFoliageShadowColor(p.shadow);
    setFoliageMidtoneColor(p.midtone);
    const roles = getFoliagePresetRoles(p.preset);
    rememberThemeRoleOverrides(roles);
    previewWith(roles);
  };

  const updateGroundBase = (hex: string) => {
    setGroundColor(hex);
    rememberThemeRoleOverrides(DERIVE_GROUND_COLOR_ROLES);
    previewWith({ groundColor: hex, ...DERIVE_GROUND_COLOR_ROLES });
  };
  const updateGroundShadow = (hex: string) => {
    setGroundShadowColor(hex);
    rememberThemeRoleOverrides(DERIVE_GROUND_COLOR_ROLES);
    previewWith({ groundShadowColor: hex, ...DERIVE_GROUND_COLOR_ROLES });
  };

  const applyGroundPreset = (p: MultiGroundPreset) => {
    setGroundColor(p.base);
    setGroundShadowColor(p.shadow);
    const roles = getGroundPresetRoles(p.preset);
    rememberThemeRoleOverrides(roles);
    previewWith(roles);
  };

  const updateGrassLawn = (hex: string) => {
    setGroundFeatureColor(hex);
    rememberThemeRoleOverrides(DERIVE_GROUND_FEATURE_COLOR_ROLES);
    previewWith({
      groundFeatureColor: hex,
      ...DERIVE_GROUND_FEATURE_COLOR_ROLES,
    });
  };
  const updateGrassTip = (hex: string) => {
    setGroundFeatureHighlightColor(hex);
    rememberThemeRoleOverrides(DERIVE_GROUND_FEATURE_COLOR_ROLES);
    previewWith({
      groundFeatureHighlightColor: hex,
      ...DERIVE_GROUND_FEATURE_COLOR_ROLES,
    });
  };
  const updateGrassEye = (hex: string) => {
    setGroundFeatureShadowColor(hex);
    rememberThemeRoleOverrides(DERIVE_GROUND_FEATURE_COLOR_ROLES);
    previewWith({
      groundFeatureShadowColor: hex,
      ...DERIVE_GROUND_FEATURE_COLOR_ROLES,
    });
  };

  const applyGrassPreset = (p: MultiGrassPreset) => {
    setGroundFeatureColor(p.lawn);
    setGroundFeatureHighlightColor(p.tip);
    setGroundFeatureShadowColor(p.eye);
    const roles = getGroundFeaturePresetRoles(p.preset);
    rememberThemeRoleOverrides(roles);
    previewWith(roles);
  };

  const updateFoliageShape = (shape: NonNullable<CustomTheme['foliageShape']>) => {
    setFoliageShape(shape);
    previewWith({ foliageShape: shape });
  };
  const updateTreeShape = (shape: TreeShapeStyle) => { setTreeShape(shape); previewWith({ treeShape: shape }); };
  const updateCanopyDensity = (density: number) => { setCanopyDensity(density); previewWith({ canopyDensity: density }); };
  const updateGroundFeature = (feat: CustomTheme['groundFeature']) => {
    const nextFeat = feat || 'grass';
    setGroundFeature(nextFeat);
    previewWith({ groundFeature: nextFeat });
  };

  const updateSkyTop = (hex: string) => { setSkyTop(hex); previewWith({ skyTop: hex }); };
  const updateSkyBottom = (hex: string) => { setSkyBottom(hex); previewWith({ skyBottom: hex }); };
  const updateParticle = (p: CustomTheme['particleType']) => {
    const roles = createTreeParticleOverrides(
      p,
      particleAmount > 0 ? particleAmount : undefined
    );
    setParticleType(p);
    setParticleAmount(roles.particleAmount ?? 0);
    rememberThemeRoleOverrides(roles);
    previewWith(roles);
  };
  const updateParticleAmount = (amount: number) => {
    const roles = createTreeParticleOverrides(particleType, amount);
    setParticleAmount(amount);
    rememberThemeRoleOverrides(roles);
    previewWith(roles);
  };

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

          {/* 1. Tree Foliage Multi-Color Section */}
          <div className="form-group">
            <div className="form-label-row">
              <label className="form-label">Tree Foliage Colors</label>
            </div>

            {/* 4-Color Multi Tone Grid */}
            <div className="multi-color-tones-grid">
              <div className="tone-color-item">
                <span className="tone-label">Main Body</span>
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
                <span className="tone-label">Highlight</span>
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
                <span className="tone-label">Shadow</span>
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
                <span className="tone-label">Midtone</span>
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
            <div className="particle-selector-grid option-grid-3">
              <button
                type="button"
                data-foliage-shape="blossom"
                className={`particle-option-btn ${foliageShape === 'blossom' ? 'active' : ''}`}
                onClick={() => updateFoliageShape('blossom')}
              >
                <span className="particle-option-symbol">🌸</span>
                <span>Blossom</span>
              </button>
              <button
                type="button"
                data-foliage-shape="leaf"
                className={`particle-option-btn ${foliageShape === 'leaf' ? 'active' : ''}`}
                onClick={() => updateFoliageShape('leaf')}
              >
                <span className="particle-option-symbol">🍃</span>
                <span>Leaf</span>
              </button>
              <button
                type="button"
                data-foliage-shape="pixel"
                className={`particle-option-btn ${foliageShape === 'pixel' ? 'active' : ''}`}
                onClick={() => updateFoliageShape('pixel')}
              >
                <span className="particle-option-symbol" aria-hidden="true">▦</span>
                <span>Pixel</span>
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

          {/* 2. Ground & Paver Colors Section*/}
          <div className="form-group">
            <div className="form-label-row">
              <label className="form-label">Ground & Stone Paver Colors</label>
            </div>
            <div className="multi-color-tones-grid">
              <div className="tone-color-item">
                <span className="tone-label">Canvas Base</span>
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
                <span className="tone-label">Stone Shadow</span>
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

          {/* 3. Ground Surface Decor Multi-Color Section*/}
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
                className={`particle-option-btn ${groundFeature === 'pixel' ? 'active' : ''}`}
                onClick={() => updateGroundFeature('pixel')}
              >
                <Box size={16} />
                <span>Pixel</span>
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

            {/* Ground Feature Color Customization */}
            {groundFeature !== 'none' && (
              <div className="particle-slider-card nested-form-card">
                <div className="form-label-row nested-form-heading">
                  <label className="form-label">
                    {groundFeature === 'pixel'
                      ? 'Pixel & Finder Colors'
                      : 'Lawn & Finder Colors'}
                  </label>
                </div>

                <div className="multi-color-tones-grid tone-grid-3">
                  <div className="tone-color-item">
                    <span className="tone-label">
                      {groundFeature === 'pixel' ? 'Pixel Base' : 'Lawn'}
                    </span>
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
                    <span className="tone-label">
                      {groundFeature === 'pixel' ? 'Pixel Highlight' : 'Tip'}
                    </span>
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
                    <span className="tone-label">QR Eye</span>
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

                {/* Quick Ground Decor Presets (Emoji + Color Dot Only) */}
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

          {/* 4. Sky Atmosphere Gradient */}
          <div className="form-group">
            <label className="form-label">Sky & Atmosphere Color</label>
            <div className="sky-gradient-row">
              <div className="sky-color-input-block">
                <span className="sky-label">Zenith Top</span>
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
                <span className="sky-label">Horizon</span>
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
