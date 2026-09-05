import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  createTreeTheme,
  resolveTreeTheme,
  TREE_THEME_PRESETS,
} from 'designqr';
import {
  DesignQRCanvas as TreeCanvas,
  type DesignQRCanvasHandle as TreeCanvasHandle,
  RenderManager,
  build3DTree,
  generateInteractiveQRMatrix,
  QR_BORDER_PADDING_DEFAULT,
  VIEW_TRANSITION_SPEED_DEFAULT,
  VIEW_TRANSITION_SPEED_MAX,
  VIEW_TRANSITION_SPEED_MIN,
  type TreeData,
} from 'designqr/editor';
import type { CustomTheme } from './editor/types';
import { THEME_PRESET_OPTIONS } from './editor/theme-presets';
import {
  DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT,
  DesignQRConfigError,
  normalizeDesignQRConfig,
  type AutoRotateDirection,
  type DesignQRConfigV1,
} from 'designqr/config';
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
  createDesignQRThemeReactSnippet,
  getRecommendedDesignQRReactExample,
} from './utils/integration';
import {
  loadEditorLogoSource,
  prepareEditorLogoSource,
  type EditorLogoCrop,
  type EditorLogoSource,
} from './utils/logo';

import { Header } from './components/Header';
import { ControlsOverlay } from './components/ControlsOverlay';
import { ShareModal } from './components/ShareModal';
import { CustomThemeModal } from './components/CustomThemeModal';
import { LogoCropDialog } from './components/LogoCropDialog';

const CUSTOM_THEMES_STORAGE_KEY = 'magic_tree_custom_themes';
const SHARED_CUSTOM_THEME_ID = 'shared-designqr-theme';
const DEFAULT_URL = 'https://design.johnson7543.com';
const EDITOR_QR_ARTWORK_SCALE = 0.88;

function loadSavedCustomThemes(): CustomTheme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.flatMap((candidate): CustomTheme[] => {
          if (
            typeof candidate !== 'object'
            || candidate === null
            || Array.isArray(candidate)
            || !('id' in candidate)
            || typeof candidate.id !== 'string'
            || !('label' in candidate)
            || typeof candidate.label !== 'string'
            || candidate.isCustom !== true
            || (
              candidate.treeShape !== undefined
              && candidate.treeShape !== 'dome'
              && candidate.treeShape !== 'wide'
              && candidate.treeShape !== 'pine'
            )
          ) {
            return [];
          }

          try {
            const config = normalizeDesignQRConfig({
              value: DEFAULT_URL,
              theme: { type: 'custom', value: candidate },
            });
            if (config.theme.type !== 'custom') return [];
            return [{
              ...config.theme.value,
              id: candidate.id,
              label: candidate.label,
              isCustom: true,
              treeShape: candidate.treeShape,
            }];
          } catch {
            return [];
          }
        });
      }
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
      viewMode: '3d' as const,
      title: '',
      titleScale: DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT,
      showContent: false,
      contentScale: DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT,
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
  const [openStageEditor, setOpenStageEditor] =
    useState<'details' | 'logo' | null>(null);
  const [qrTitle, setQrTitle] = useState<string>(initialConfig.title ?? '');
  const qrTitleScale = initialConfig.titleScale
    ?? DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT;
  const [transparentBackground, setTransparentBackground] = useState<boolean>(
    initialConfig.transparentBackground ?? false
  );
  const [showQrContent, setShowQrContent] = useState<boolean>(
    initialConfig.showContent ?? false
  );
  const qrContentScale = initialConfig.contentScale
    ?? DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT;
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
    initialConfig.interaction?.transitionSpeed ?? VIEW_TRANSITION_SPEED_DEFAULT
  );
  const [isTurntable, setIsTurntable] = useState<boolean>(
    initialConfig.interaction?.autoRotate ?? false
  );
  const [autoRotateDirection, setAutoRotateDirection] =
    useState<AutoRotateDirection>(
      initialConfig.interaction?.autoRotateDirection ?? 'clockwise'
    );
  const [logo, setLogo] = useState<DesignQRConfigV1['logo']>(
    () => createDesignQRConfig(initialConfig).logo
  );
  const [logoRuntimeError, setLogoRuntimeError] = useState('');
  const [logoEditorError, setLogoEditorError] = useState('');
  const [isPreparingLogo, setIsPreparingLogo] = useState(false);
  const [pendingLogoSource, setPendingLogoSource] =
    useState<EditorLogoSource | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);

  const renderManagerRef = useRef<RenderManager | null>(null);
  const treeCanvasRef = useRef<TreeCanvasHandle | null>(null);
  const pendingLogoSourceRef = useRef<EditorLogoSource | null>(null);
  const logoUploadRequestRef = useRef(0);

  const replacePendingLogoSource = useCallback((next: EditorLogoSource | null) => {
    const previous = pendingLogoSourceRef.current;
    if (previous === next) return;
    previous?.close();
    pendingLogoSourceRef.current = next;
    setPendingLogoSource(next);
  }, []);

  useEffect(() => () => {
    logoUploadRequestRef.current += 1;
    pendingLogoSourceRef.current?.close();
    pendingLogoSourceRef.current = null;
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

  const currentSeasonPreset = THEME_PRESET_OPTIONS[seasonId]
    ?? THEME_PRESET_OPTIONS[0];
  const currentPresetTheme = TREE_THEME_PRESETS[currentSeasonPreset.name];
  const rendererTheme = useMemo(() => {
    if (activeCustomTheme) {
      return resolveTreeTheme({ type: 'custom', value: activeCustomTheme });
    }
    return resolveTreeTheme({
      type: 'preset',
      preset: currentSeasonPreset.name,
    });
  }, [activeCustomTheme, currentSeasonPreset.name]);

  // Dynamic Background Gradient
  const backgroundStyle = useMemo(() => {
    if (activeCustomTheme) {
      return `radial-gradient(circle at 50% 30%, ${activeCustomTheme.skyTop} 0%, ${activeCustomTheme.skyBottom} 100%)`;
    }
    return `radial-gradient(circle at 50% 30%, ${currentPresetTheme.skyTop} 0%, ${currentPresetTheme.skyBottom} 100%)`;
  }, [activeCustomTheme, currentPresetTheme]);

  // Sync background directly to body for instant smooth updates
  useEffect(() => {
    const previousBackground = document.body.style.background;
    document.body.style.background = backgroundStyle;
    return () => {
      document.body.style.background = previousBackground;
    };
  }, [backgroundStyle]);

  // 1. Prepare the exact QR matrix before allocating any procedural tree data.
  const qrPreparation = useMemo(() => {
    try {
      return {
        ok: true as const,
        matrix: generateInteractiveQRMatrix(
          debouncedUrl || DEFAULT_URL,
          logo !== false
        ),
      };
    } catch (cause) {
      return {
        ok: false as const,
        error: cause instanceof DesignQRConfigError
          ? cause
          : new DesignQRConfigError(
              'QR_GENERATION_FAILED',
              'DesignQR could not encode this value.',
              cause
            ),
      };
    }
  }, [debouncedUrl, logo]);

  const treeData = useMemo<TreeData | null>(() => {
    if (!qrPreparation.ok) return null;
    return build3DTree(
      qrPreparation.matrix.modules,
      0.5,
      activeCustomTheme?.treeShape || 'dome'
    );
  }, [qrPreparation, activeCustomTheme?.treeShape]);

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
      const season = THEME_PRESET_OPTIONS[seasonId]
        ?? THEME_PRESET_OPTIONS[0];

      templateTheme = {
        ...createTreeTheme(season.name),
        id: '',
        label: `${season.label} Custom`,
        isCustom: true,
        treeShape: 'dome',
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
    setEditingTheme(null);
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
    setEditingTheme(null);
    setThemeModalOpen(false);
  };

  const handleDeleteCustomTheme = (themeId: string) => {
    setCustomThemes((prev) => prev.filter((t) => t.id !== themeId));
    if (activeThemeId === themeId) {
      setActiveThemeId('0'); // Fallback to Spring
    }
  };

  // 3. Handle Turntable Toggle
  const handleToggleTurntable = () => {
    setIsTurntable((enabled) => !enabled);
  };

  const handleResetRotation = () => {
    setIsTurntable(false);
    renderManagerRef.current?.resetRotation();
  };

  const handleToggleAutoRotateDirection = () => {
    setAutoRotateDirection((direction) => (
      direction === 'clockwise' ? 'counterclockwise' : 'clockwise'
    ));
  };

  const handleTransitionSpeedChange = (speed: number) => {
    const nextSpeed = Math.min(
      VIEW_TRANSITION_SPEED_MAX,
      Math.max(VIEW_TRANSITION_SPEED_MIN, speed)
    );
    setTransitionSpeed(nextSpeed);
    renderManagerRef.current?.setTransitionSpeed(nextSpeed);
  };

  const handleLogoChange = useCallback((nextLogo: DesignQRConfigV1['logo']) => {
    setLogoRuntimeError('');
    setLogoEditorError('');
    setLogo(nextLogo);
  }, []);

  const handleLogoFileSelect = useCallback(async (file: File) => {
    const request = ++logoUploadRequestRef.current;
    replacePendingLogoSource(null);
    setLogoEditorError('');
    setIsPreparingLogo(true);

    try {
      const source = await loadEditorLogoSource(file);
      if (request !== logoUploadRequestRef.current) {
        source.close();
        return;
      }
      pendingLogoSourceRef.current = source;
      setPendingLogoSource(source);
    } catch (cause) {
      if (request === logoUploadRequestRef.current) {
        setLogoEditorError(
          cause instanceof Error ? cause.message : 'The logo could not be opened.'
        );
      }
    } finally {
      if (request === logoUploadRequestRef.current) setIsPreparingLogo(false);
    }
  }, [replacePendingLogoSource]);

  const handleCancelLogoCrop = useCallback(() => {
    if (isPreparingLogo) return;
    logoUploadRequestRef.current += 1;
    replacePendingLogoSource(null);
    setLogoEditorError('');
  }, [isPreparingLogo, replacePendingLogoSource]);

  const handleApplyLogoCrop = useCallback(async (crop: EditorLogoCrop) => {
    const source = pendingLogoSourceRef.current;
    if (!source || isPreparingLogo) return;
    const request = ++logoUploadRequestRef.current;
    setLogoEditorError('');
    setIsPreparingLogo(true);

    try {
      const prepared = await prepareEditorLogoSource(source, crop);
      if (request !== logoUploadRequestRef.current) return;
      handleLogoChange(prepared);
      replacePendingLogoSource(null);
    } catch (cause) {
      if (request === logoUploadRequestRef.current) {
        setLogoEditorError(
          cause instanceof Error ? cause.message : 'The logo could not be cropped.'
        );
      }
    } finally {
      if (request === logoUploadRequestRef.current) setIsPreparingLogo(false);
    }
  }, [handleLogoChange, isPreparingLogo, replacePendingLogoSource]);

  const handleRendererError = useCallback((cause: unknown) => {
    if (
      typeof cause === 'object'
      && cause !== null
      && 'code' in cause
      && cause.code === 'LOGO_LOAD_FAILED'
    ) {
      setLogoRuntimeError(
        'The logo could not be loaded. Check the file or hosted image access.'
      );
    }
  }, []);

  // 4. Build one canonical state for direct links, hosted embeds, and React.
  const currentShareConfig = useMemo<ShareConfig>(() => ({
    url: url || DEFAULT_URL,
    season: seasonId,
    viewMode,
    title: qrTitle,
    titleScale: qrTitleScale,
    showContent: showQrContent,
    contentScale: qrContentScale,
    borderEnabled: qrBorderEnabled,
    borderPadding: qrBorderPadding,
    transparentBackground,
    customTheme: activeCustomTheme ?? undefined,
    treeShape: activeCustomTheme?.treeShape,
    interaction: {
      dragToRotate: true,
      tapToToggleView: true,
      autoRotate: isTurntable,
      autoRotateDirection,
      motionBlur: enableMotionBlur,
      transitionSpeed,
    },
    logo,
  }), [
    activeCustomTheme,
    autoRotateDirection,
    enableMotionBlur,
    isTurntable,
    logo,
    qrBorderEnabled,
    qrBorderPadding,
    qrTitle,
    qrTitleScale,
    seasonId,
    showQrContent,
    qrContentScale,
    transparentBackground,
    transitionSpeed,
    url,
    viewMode,
  ]);

  const isQRPreparationPending = (
    url || DEFAULT_URL
  ) !== (
    debouncedUrl || DEFAULT_URL
  );
  const designQRConfigPreparation = useMemo(() => {
    if (isQRPreparationPending) {
      return { ok: false as const, pending: true as const };
    }
    if (!qrPreparation.ok) {
      return {
        ok: false as const,
        pending: false as const,
        error: qrPreparation.error,
      };
    }

    try {
      return {
        ok: true as const,
        config: createDesignQRConfig(currentShareConfig),
      };
    } catch (cause) {
      return {
        ok: false as const,
        pending: false as const,
        error: cause instanceof DesignQRConfigError
          ? cause
          : new DesignQRConfigError(
              'INVALID_CONFIG',
              'This DesignQR configuration is invalid.',
              cause
            ),
      };
    }
  }, [currentShareConfig, isQRPreparationPending, qrPreparation]);
  const designQRConfig = designQRConfigPreparation.ok
    ? designQRConfigPreparation.config
    : null;
  const encodedShareConfig = useMemo(
    () => designQRConfig ? encodeShareConfig(currentShareConfig) : '',
    [currentShareConfig, designQRConfig]
  );
  const shareConfigurationError = !qrPreparation.ok
    ? qrPreparation.error.message
    : !designQRConfigPreparation.ok && !designQRConfigPreparation.pending
      ? designQRConfigPreparation.error.message
      : designQRConfigPreparation.ok && !encodedShareConfig
        ? 'This design is too large for an editable link. Use a simpler logo or shorter content.'
        : '';
  const shareDisabled = isQRPreparationPending || !designQRConfigPreparation.ok;
  const qrGenerationError = qrPreparation.ok ? null : qrPreparation.error;
  const shareUrl = useMemo(() => {
    return encodedShareConfig
      ? `${window.location.origin}/qr?q=${encodedShareConfig}`
      : '';
  }, [encodedShareConfig]);
  const embedUrl = useMemo(() => encodedShareConfig
    && designQRConfig
    ? createDesignQREmbedUrl(designQRConfig, { origin: window.location.origin })
    : '', [designQRConfig, encodedShareConfig]);
  const embedCode = useMemo(
    () => embedUrl ? createDesignQRIframeMarkup(embedUrl) : '',
    [embedUrl]
  );
  const reactCode = useMemo(
    () => designQRConfig ? createDesignQRReactSnippet(designQRConfig) : '',
    [designQRConfig]
  );
  const reactAdvancedCode = useMemo(
    () => designQRConfig ? createDesignQRAdvancedReactSnippet(designQRConfig) : '',
    [designQRConfig]
  );
  const reactThemeCode = useMemo(
    () => designQRConfig ? createDesignQRThemeReactSnippet(designQRConfig) : '',
    [designQRConfig]
  );
  const recommendedReactExampleMode = useMemo(
    () => designQRConfig
      ? getRecommendedDesignQRReactExample(designQRConfig)
      : 'simple',
    [designQRConfig]
  );

  // 5. Download only a presentation that matches the currently prepared value.
  const handleDownload = async () => {
    if (shareDisabled) return;
    const blob = await treeCanvasRef.current?.exportImage();
    if (!blob) return;
    downloadImageBlob(blob, `designqr-${currentSeasonPreset.name}.png`);
  };

  // Keep the editor URL synchronized with the same canonical configuration.
  useEffect(() => {
    const newUrl = encodedShareConfig ? `?q=${encodedShareConfig}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [
    encodedShareConfig,
  ]);

  const handleToggleScanMode = useCallback(() => {
    if (viewMode === 'scan') {
      setOpenStageEditor((editor) => editor === 'details' ? null : editor);
    }
    setViewMode(viewMode === '3d' ? 'scan' : '3d');
  }, [viewMode]);

  const handleSetViewMode = useCallback((mode: '3d' | 'scan') => {
    if (mode === viewMode) return;
    if (mode === '3d') {
      setOpenStageEditor((editor) => editor === 'details' ? null : editor);
    }
    setViewMode(mode);
  }, [viewMode]);

  return (
    <div
      className={`app-root season-${currentSeasonPreset.name} view-${viewMode}`}
      style={{ background: backgroundStyle }}
    >
      <Header
        viewMode={viewMode}
        onSetViewMode={handleSetViewMode}
      />

      <main className={`main-viewport${transparentBackground ? ' transparency-preview' : ''}`}>
        {treeData ? (
          <TreeCanvas
            ref={treeCanvasRef}
            className="designqr-editor-player"
            treeData={treeData}
            theme={rendererTheme}
            viewMode={viewMode}
            onToggleScanMode={handleToggleScanMode}
            onRendererReady={(manager) => {
              renderManagerRef.current = manager;
              manager.setTransitionSpeed(transitionSpeed);
            }}
            onRendererError={handleRendererError}
            enableMotionBlur={enableMotionBlur}
            autoRotate={isTurntable}
            autoRotateDirection={autoRotateDirection}
            logo={logo}
            transparentBackground={transparentBackground}
            backgroundTop={
              activeCustomTheme?.skyTop ?? currentPresetTheme.skyTop
            }
            backgroundBottom={
              activeCustomTheme?.skyBottom ?? currentPresetTheme.skyBottom
            }
            showQrDetails={viewMode === 'scan'}
            qrTitle={qrTitle}
            qrTitleScale={qrTitleScale}
            showQrContent={showQrContent}
            qrContentScale={qrContentScale}
            qrValue={debouncedUrl || DEFAULT_URL}
            qrBorderEnabled={qrBorderEnabled}
            qrBorderPadding={qrBorderPadding}
            qrTitleColor={
              activeCustomTheme?.titleColor
              || activeCustomTheme?.foliageShadowColor
              || activeCustomTheme?.foliageColor
              || currentPresetTheme.titleColor
            }
            qrArtworkScale={EDITOR_QR_ARTWORK_SCALE}
          />
        ) : (
          <div
            className="designqr-editor-error glass-panel"
            role="alert"
            data-designqr-error-code={qrGenerationError?.code}
          >
            <strong>Unable to generate this DesignQR</strong>
            <span>{qrGenerationError?.message}</span>
          </div>
        )}
      </main>

      <ControlsOverlay
        url={url}
        onUrlChange={handleUrlChange}
        activeThemeId={activeThemeId}
        onSelectTheme={handleSelectTheme}
        customThemes={customThemes}
        onOpenCreateTheme={handleOpenCreateTheme}
        onOpenEditTheme={handleOpenEditTheme}
        onShare={() => {
          if (!shareDisabled) setShareModalOpen(true);
        }}
        shareDisabled={shareDisabled}
        isTurntable={isTurntable}
        onToggleTurntable={handleToggleTurntable}
        autoRotateDirection={autoRotateDirection}
        onToggleAutoRotateDirection={handleToggleAutoRotateDirection}
        onResetRotation={handleResetRotation}
        viewMode={viewMode}
        onToggleScanMode={handleToggleScanMode}
        isDetailsEditorOpen={openStageEditor === 'details'}
        onToggleDetailsEditor={() => setOpenStageEditor((editor) => (
          editor === 'details' ? null : 'details'
        ))}
        isLogoEditorOpen={openStageEditor === 'logo'}
        onToggleLogoEditor={() => setOpenStageEditor((editor) => (
          editor === 'logo' ? null : 'logo'
        ))}
        qrTitle={qrTitle}
        onQrTitleChange={setQrTitle}
        transparentBackground={transparentBackground}
        onToggleTransparentBackground={setTransparentBackground}
        showQrContent={showQrContent}
        onToggleShowContent={setShowQrContent}
        qrBorderEnabled={qrBorderEnabled}
        onToggleQrBorder={setQrBorderEnabled}
        qrBorderPadding={qrBorderPadding}
        onQrBorderPaddingChange={setQrBorderPadding}
        logo={logo}
        onLogoChange={handleLogoChange}
        onLogoFileSelect={(file) => void handleLogoFileSelect(file)}
        isPreparingLogo={isPreparingLogo}
        logoEditorError={logoEditorError}
        shareConfigurationError={logoRuntimeError || shareConfigurationError}
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
          reactThemeCode={reactThemeCode}
          recommendedReactExampleMode={recommendedReactExampleMode}
          configurationError={shareConfigurationError}
          downloadDisabled={shareDisabled}
          onClose={() => setShareModalOpen(false)}
          onDownload={handleDownload}
        />
      )}

      {pendingLogoSource && (
        <LogoCropDialog
          key={`${pendingLogoSource.file.name}-${pendingLogoSource.file.size}-${pendingLogoSource.file.lastModified}`}
          source={pendingLogoSource}
          isPreparing={isPreparingLogo}
          error={logoEditorError}
          onCancel={handleCancelLogoCrop}
          onApply={(crop) => void handleApplyLogoCrop(crop)}
        />
      )}
    </div>
  );
};

export default App;
