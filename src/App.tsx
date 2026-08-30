import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  DesignQRCanvas as TreeCanvas,
  type DesignQRCanvasHandle as TreeCanvasHandle,
  RenderManager,
  build3DTree,
  generateQRMatrix,
  QR_BORDER_PADDING_DEFAULT,
  SEASONS,
  SEASON_ENV_CONFIGS,
  VIEW_TRANSITION_SPEED_DEFAULT,
  VIEW_TRANSITION_SPEED_MAX,
  VIEW_TRANSITION_SPEED_MIN,
  type TreeData,
} from 'designqr/editor';
import type { CustomTheme } from './editor/types';
import { downloadImageBlob } from './utils/export';
import {
  createDesignQREmbedUrl,
  createDesignQRIframeMarkup,
} from 'designqr/embed';
import {
  createDesignQRConfig,
  decodeShareConfig,
  encodeShareConfig,
  type ShareConfig,
} from './utils/share';
import {
  createDesignQRAdvancedReactSnippet,
  createDesignQRReactSnippet,
} from './utils/integration';

import { Header } from './components/Header';
import { ControlsOverlay } from './components/ControlsOverlay';
import { ShareModal } from './components/ShareModal';
import { CustomThemeModal } from './components/CustomThemeModal';

const CUSTOM_THEMES_STORAGE_KEY = 'magic_tree_custom_themes';
const SHARED_CUSTOM_THEME_ID = 'shared-designqr-theme';
const SCAN_EXIT_DETAILS_DELAY_MS = 120;
const DEFAULT_URL = 'https://design.johnson7543.com';

function rgbTupleToHex(rgb: [number, number, number]): string {
  const r = Math.round(rgb[0] * 255).toString(16).padStart(2, '0');
  const g = Math.round(rgb[1] * 255).toString(16).padStart(2, '0');
  const b = Math.round(rgb[2] * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function loadSavedCustomThemes(): CustomTheme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load custom themes', e);
  }
  return [];
}

export const App: React.FC = () => {
  // Initialize state from URL params if available
  const [initialConfig] = useState<ShareConfig>(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
      const decoded = decodeShareConfig(q);
      if (decoded) return decoded;
    }
    return {
      url: DEFAULT_URL,
      season: 0, // Spring default
      palette: 0,
      viewMode: '3d' as const,
      title: '',
      showContent: false,
      borderEnabled: false,
      borderPadding: QR_BORDER_PADDING_DEFAULT,
    };
  });

  const [url, setUrl] = useState<string>(initialConfig.url);
  const [debouncedUrl, setDebouncedUrl] = useState<string>(initialConfig.url);
  const [activeThemeId, setActiveThemeId] = useState<string>(
    initialConfig.customTheme ? SHARED_CUSTOM_THEME_ID : String(initialConfig.season)
  );
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>(() => {
    const savedThemes = loadSavedCustomThemes();
    if (!initialConfig.customTheme) return savedThemes;

    const importedTheme: CustomTheme = {
      ...initialConfig.customTheme,
      id: SHARED_CUSTOM_THEME_ID,
      label: 'Shared Theme',
      isCustom: true,
      treeShape: initialConfig.treeShape ?? 'dome',
    };
    return [
      importedTheme,
      ...savedThemes.filter((theme) => theme.id !== SHARED_CUSTOM_THEME_ID),
    ];
  });
  const [themeModalOpen, setThemeModalOpen] = useState<boolean>(false);
  const [editingTheme, setEditingTheme] = useState<CustomTheme | null>(null);
  const [previewTheme, setPreviewTheme] = useState<CustomTheme | null>(null);
  const preModalThemeIdRef = useRef<string>('0');

  const [viewMode, setViewMode] = useState<'3d' | 'scan'>(initialConfig.viewMode ?? '3d');
  const [isDetailsEditorOpen, setIsDetailsEditorOpen] = useState<boolean>(false);
  const [qrTitle, setQrTitle] = useState<string>(initialConfig.title ?? '');
  const [showQrContent, setShowQrContent] = useState<boolean>(
    initialConfig.showContent ?? false
  );
  const [qrBorderEnabled, setQrBorderEnabled] = useState<boolean>(
    initialConfig.borderEnabled ?? false
  );
  const [qrBorderPadding, setQrBorderPadding] = useState<number>(
    initialConfig.borderPadding ?? QR_BORDER_PADDING_DEFAULT
  );
  const [enableMotionBlur, setEnableMotionBlur] = useState<boolean>(
    initialConfig.interaction?.motionBlur ?? true
  );
  const [transitionSpeed, setTransitionSpeed] = useState<number>(
    VIEW_TRANSITION_SPEED_DEFAULT
  );
  const [isTurntable, setIsTurntable] = useState<boolean>(
    initialConfig.interaction?.autoRotate ?? false
  );
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [isExitingScan, setIsExitingScan] = useState<boolean>(false);

  const renderManagerRef = useRef<RenderManager | null>(null);
  const treeCanvasRef = useRef<TreeCanvasHandle | null>(null);
  const scanExitTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (scanExitTimeoutRef.current !== null) {
        window.clearTimeout(scanExitTimeoutRef.current);
      }
    };
  }, []);

  // Debounce tree & QR code regeneration (220ms) so typing in the URL input bar remains 60fps instant and lag-free
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUrl(url);
    }, 220);
    return () => clearTimeout(timer);
  }, [url]);

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    if (!newUrl) {
      setDebouncedUrl('');
    }
  };

  // Persist custom themes in localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(customThemes));
    } catch (e) {
      console.error('Failed to persist custom themes', e);
    }
  }, [customThemes]);

  // Resolve active theme details (preview theme takes priority when modal is open)
  const activeCustomTheme = useMemo(() => {
    if (previewTheme) return previewTheme;
    return customThemes.find((t) => t.id === activeThemeId) || null;
  }, [customThemes, activeThemeId, previewTheme]);

  const seasonId = useMemo(() => {
    const parsed = parseInt(activeThemeId, 10);
    return isNaN(parsed) ? 0 : parsed;
  }, [activeThemeId]);

  const currentSeasonPreset = SEASONS[seasonId] || SEASONS[0];

  // Dynamic Background Gradient
  const backgroundStyle = useMemo(() => {
    if (activeCustomTheme) {
      return `radial-gradient(circle at 50% 30%, ${activeCustomTheme.skyTop} 0%, ${activeCustomTheme.skyBottom} 100%)`;
    }
    return `radial-gradient(circle at 50% 30%, rgb(${Math.round(currentSeasonPreset.skyTop[0] * 255)}, ${Math.round(currentSeasonPreset.skyTop[1] * 255)}, ${Math.round(currentSeasonPreset.skyTop[2] * 255)}) 0%, rgb(${Math.round(currentSeasonPreset.skyBottom[0] * 255)}, ${Math.round(currentSeasonPreset.skyBottom[1] * 255)}, ${Math.round(currentSeasonPreset.skyBottom[2] * 255)}) 100%)`;
  }, [activeCustomTheme, currentSeasonPreset]);

  // Sync background directly to body for instant smooth updates
  useEffect(() => {
    document.body.style.background = backgroundStyle;
  }, [backgroundStyle]);

  // 1. Generate QR Matrix and 3D Tree Data (from debounced URL)
  const qrMatrix = useMemo(() => {
    return generateQRMatrix(debouncedUrl || DEFAULT_URL, 'M');
  }, [debouncedUrl]);

  const treeData: TreeData = useMemo(() => {
    return build3DTree(qrMatrix.modules, 0.5, activeCustomTheme?.treeShape || 'dome');
  }, [qrMatrix, activeCustomTheme?.treeShape]);

  // 2. Custom Theme Management Handlers
  const handleSelectTheme = (themeId: string) => {
    setActiveThemeId(themeId);
  };

  const handleOpenCreateTheme = () => {
    preModalThemeIdRef.current = activeThemeId;

    let templateTheme: CustomTheme;
    if (activeCustomTheme) {
      templateTheme = {
        ...activeCustomTheme,
        id: '', // Blank ID marks it as a new custom theme
        label: `${activeCustomTheme.label} Copy`,
      };
    } else {
      const season = SEASONS[seasonId] || SEASONS[0];
      const env = SEASON_ENV_CONFIGS[seasonId] || SEASON_ENV_CONFIGS[0];

      let particleType: CustomTheme['particleType'] = 'leaf';
      if (seasonId === 0) particleType = 'sakura';
      else if (seasonId === 1) particleType = 'fireflies';
      else if (seasonId === 2) particleType = 'leaf';
      else if (seasonId === 3) particleType = 'snow';

      let foliageHighlight = '#FDF0F5';
      let foliageShadow = '#D98EB0';
      let foliageMidtone = '#F9D3E3';
      let groundShadow = '#C38F95';
      let grassHighlight = '#C2D65C';
      let grassShadow = '#286018';

      if (seasonId === 1) {
        // Summer (033 立夏)
        foliageHighlight = '#99CC81'; // ⑤ 若苗色 (Gentle natural sprout tip)
        foliageShadow = '#00785E';    // ③ 深綠 (Deep forest shadow)
        foliageMidtone = '#00AC7A';   // ① 青竹色 (Fresh bamboo accent)
        groundShadow = '#8A987C';     // ⑧ 素鼠
        grassHighlight = '#D7DE8A';   // ⑦ 嬰兒
        grassShadow = '#02983B';      // ④ 翠玉
      } else if (seasonId === 2) {
        // Autumn (京都清水寺 楓葉)
        foliageHighlight = '#F4A358'; // ④ 小春日和
        foliageShadow = '#BD3528';    // ③ 紅絹
        foliageMidtone = '#E77433';   // ② 楓
        groundShadow = '#C6AE8D';     // ⑦ 檜舞台
        grassHighlight = '#BD956E';   // ⑤ 酒林
        grassShadow = '#5D4C35';      // ⑨ 山眠
      } else if (seasonId === 3) {
        // Winter
        foliageHighlight = '#F5F8FC';
        foliageShadow = '#6084A7';
        foliageMidtone = '#8CAECC';
        groundShadow = '#8DA1B5';
        grassHighlight = '#D9EBF8';
        grassShadow = '#305E88';
      }

      templateTheme = {
        id: '',
        label: `${season.label} Custom`,
        isCustom: true,
        foliageColor: season.foliageHex,
        foliageHighlightColor: foliageHighlight,
        foliageShadowColor: foliageShadow,
        foliageMidtoneColor: foliageMidtone,
        foliageShape: (seasonId === 0 || seasonId === 3) ? 'blossom' : 'leaf',
        treeShape: 'dome',
        canopyDensity: Math.round((env.canopyDensity ?? 1.0) * 100),
        groundColor: rgbTupleToHex(season.dirtColor),
        groundShadowColor: groundShadow,
        groundFeature: seasonId === 3 ? 'snow' : 'grass',
        groundFeatureColor: seasonId === 3 ? '#FFFFFF' : rgbTupleToHex(season.grassColor),
        groundFeatureHighlightColor: grassHighlight,
        groundFeatureShadowColor: grassShadow,
        skyTop: rgbTupleToHex(season.skyTop),
        skyBottom: rgbTupleToHex(season.skyBottom),
        particleType,
        particleAmount: env.fallingLeavesCount || (seasonId === 3 ? 0 : 40),
        groundLeavesAmount: env.groundLeafCount || 0,
      };
    }

    setEditingTheme(templateTheme);
    setThemeModalOpen(true);
  };

  const handleOpenEditTheme = (theme: CustomTheme) => {
    preModalThemeIdRef.current = activeThemeId;
    setEditingTheme(theme);
    setThemeModalOpen(true);
  };

  const handlePreviewTheme = (theme: CustomTheme) => {
    setPreviewTheme(theme);
  };

  const handleCloseThemeModal = () => {
    setPreviewTheme(null);
    setActiveThemeId(preModalThemeIdRef.current);
    setThemeModalOpen(false);
  };

  const handleSaveCustomTheme = (theme: CustomTheme) => {
    setPreviewTheme(null);
    setCustomThemes((prev) => {
      const idx = prev.findIndex((t) => t.id === theme.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = theme;
        return next;
      }
      return [...prev, theme];
    });
    setActiveThemeId(theme.id);
  };

  const handleDeleteCustomTheme = (themeId: string) => {
    setCustomThemes((prev) => prev.filter((t) => t.id !== themeId));
    if (activeThemeId === themeId) {
      setActiveThemeId('0'); // Fallback to Spring
    }
  };

  // 3. Handle Turntable Toggle
  const handleToggleTurntable = () => {
    const next = !isTurntable;
    setIsTurntable(next);
    renderManagerRef.current?.toggleTurntable(next);
  };

  const handleResetRotation = () => {
    setIsTurntable(false);
    renderManagerRef.current?.resetRotation();
  };

  const handleTransitionSpeedChange = (speed: number) => {
    const nextSpeed = Math.min(
      VIEW_TRANSITION_SPEED_MAX,
      Math.max(VIEW_TRANSITION_SPEED_MIN, speed)
    );
    setTransitionSpeed(nextSpeed);
    renderManagerRef.current?.setTransitionSpeed(nextSpeed);
  };

  // 4. Download the same committed presentation canvas shown in the editor.
  const handleDownload = async () => {
    const blob = await treeCanvasRef.current?.exportImage();
    if (!blob) return;
    downloadImageBlob(blob, `designqr-${currentSeasonPreset.name}.png`);
  };

  // 5. Build one canonical state for direct links, hosted embeds, and React.
  const currentShareConfig = useMemo<ShareConfig>(() => ({
    url: url || DEFAULT_URL,
    season: seasonId,
    palette: 0,
    viewMode,
    title: qrTitle,
    showContent: showQrContent,
    borderEnabled: qrBorderEnabled,
    borderPadding: qrBorderPadding,
    customTheme: activeCustomTheme ?? undefined,
    treeShape: activeCustomTheme?.treeShape,
    interaction: {
      dragToRotate: true,
      tapToToggleView: true,
      autoRotate: isTurntable,
      motionBlur: enableMotionBlur,
    },
    quality: 'high',
  }), [
    activeCustomTheme,
    enableMotionBlur,
    isTurntable,
    qrBorderEnabled,
    qrBorderPadding,
    qrTitle,
    seasonId,
    showQrContent,
    url,
    viewMode,
  ]);

  const encodedShareConfig = useMemo(
    () => encodeShareConfig(currentShareConfig),
    [currentShareConfig]
  );
  const designQRConfig = useMemo(
    () => createDesignQRConfig(currentShareConfig),
    [currentShareConfig]
  );
  const shareUrl = useMemo(() => {
    return `${window.location.origin}/qr?q=${encodedShareConfig}`;
  }, [encodedShareConfig]);
  const embedUrl = useMemo(() => createDesignQREmbedUrl(designQRConfig, {
    origin: window.location.origin,
  }), [designQRConfig]);
  const embedCode = useMemo(
    () => createDesignQRIframeMarkup(embedUrl),
    [embedUrl]
  );
  const reactCode = useMemo(
    () => createDesignQRReactSnippet(designQRConfig),
    [designQRConfig]
  );
  const reactAdvancedCode = useMemo(
    () => createDesignQRAdvancedReactSnippet(designQRConfig),
    [designQRConfig]
  );

  // Keep the editor URL synchronized with the same canonical configuration.
  useEffect(() => {
    const newUrl = encodedShareConfig ? `?q=${encodedShareConfig}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [
    encodedShareConfig,
  ]);

  const beginScanExit = useCallback(() => {
    if (isExitingScan || scanExitTimeoutRef.current !== null) return;

    setIsDetailsEditorOpen(false);
    setIsExitingScan(true);
    scanExitTimeoutRef.current = window.setTimeout(() => {
      setViewMode('3d');
      setIsExitingScan(false);
      scanExitTimeoutRef.current = null;
    }, SCAN_EXIT_DETAILS_DELAY_MS);
  }, [isExitingScan]);

  const handleToggleScanMode = useCallback(() => {
    if (viewMode === '3d') {
      setIsExitingScan(false);
      setViewMode('scan');
    } else {
      beginScanExit();
    }
  }, [beginScanExit, viewMode]);

  const handleSetViewMode = useCallback((mode: '3d' | 'scan') => {
    if (mode === '3d' && viewMode === 'scan') {
      beginScanExit();
      return;
    }

    if (scanExitTimeoutRef.current !== null) {
      window.clearTimeout(scanExitTimeoutRef.current);
      scanExitTimeoutRef.current = null;
    }
    setIsExitingScan(false);
    setViewMode(mode);
  }, [beginScanExit, viewMode]);

  return (
    <div
      className={`app-root season-${currentSeasonPreset.name} view-${viewMode}`}
      style={{ background: backgroundStyle }}
    >
      <Header
        viewMode={viewMode}
        onSetViewMode={handleSetViewMode}
      />

      <main className="main-viewport">
        <TreeCanvas
          ref={treeCanvasRef}
          treeData={treeData}
          seasonId={seasonId}
          customTheme={activeCustomTheme}
          customColor={[0.91, 0.63, 0.69]}
          customStrength={activeCustomTheme ? 1.0 : 0.0}
          viewMode={viewMode}
          onToggleScanMode={handleToggleScanMode}
          onRendererReady={(manager) => {
            renderManagerRef.current = manager;
            manager.setTransitionSpeed(transitionSpeed);
          }}
          enableMotionBlur={enableMotionBlur}
          autoRotate={isTurntable}
          backgroundTop={
            activeCustomTheme?.skyTop ?? rgbTupleToHex(currentSeasonPreset.skyTop)
          }
          backgroundBottom={
            activeCustomTheme?.skyBottom ?? rgbTupleToHex(currentSeasonPreset.skyBottom)
          }
          showQrDetails={viewMode === 'scan' && !isExitingScan}
          qrTitle={qrTitle}
          showQrContent={showQrContent}
          qrValue={url}
          qrBorderEnabled={qrBorderEnabled}
          qrBorderPadding={qrBorderPadding}
          qrTitleColor={
            activeCustomTheme?.foliageShadowColor
            || activeCustomTheme?.foliageColor
            || currentSeasonPreset.titleHex
          }
        />
      </main>

      <ControlsOverlay
        url={url}
        onUrlChange={handleUrlChange}
        activeThemeId={activeThemeId}
        onSelectTheme={handleSelectTheme}
        customThemes={customThemes}
        onOpenCreateTheme={handleOpenCreateTheme}
        onOpenEditTheme={handleOpenEditTheme}
        onShare={() => setShareModalOpen(true)}
        isTurntable={isTurntable}
        onToggleTurntable={handleToggleTurntable}
        onResetRotation={handleResetRotation}
        viewMode={viewMode}
        onToggleScanMode={handleToggleScanMode}
        hideScanDetails={isExitingScan}
        isDetailsEditorOpen={isDetailsEditorOpen}
        onToggleDetailsEditor={() => setIsDetailsEditorOpen((open) => !open)}
        qrTitle={qrTitle}
        onQrTitleChange={setQrTitle}
        showQrContent={showQrContent}
        onToggleShowContent={setShowQrContent}
        qrBorderEnabled={qrBorderEnabled}
        onToggleQrBorder={setQrBorderEnabled}
        qrBorderPadding={qrBorderPadding}
        onQrBorderPaddingChange={setQrBorderPadding}
        enableMotionBlur={enableMotionBlur}
        onToggleMotionBlur={setEnableMotionBlur}
        transitionSpeed={transitionSpeed}
        onTransitionSpeedChange={handleTransitionSpeedChange}
      />

      {themeModalOpen && (
        <CustomThemeModal
          key={editingTheme ? `${editingTheme.id || 'new'}-${editingTheme.label}` : 'new-theme'}
          isOpen={themeModalOpen}
          onClose={handleCloseThemeModal}
          initialTheme={editingTheme}
          onSaveTheme={handleSaveCustomTheme}
          onDeleteTheme={handleDeleteCustomTheme}
          onPreview={handlePreviewTheme}
        />
      )}

      {shareModalOpen && (
        <ShareModal
          shareUrl={shareUrl}
          embedUrl={embedUrl}
          embedCode={embedCode}
          reactCode={reactCode}
          reactAdvancedCode={reactAdvancedCode}
          onClose={() => setShareModalOpen(false)}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
};

export default App;
