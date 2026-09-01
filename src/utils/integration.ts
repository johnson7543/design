import { resolveTreeTheme } from 'designqr';
import {
  normalizeDesignQRConfig,
  type DesignQRConfigV1,
} from 'designqr/config';

export type DesignQRReactExampleMode = 'simple' | 'advanced' | 'theme';

const FULL_THEME_SECTION_END_KEYS = new Set([
  'foliageVerticalLift',
  'blossomCenterColor',
  'branchStyle',
  'groundFeaturePaletteVariations',
  'qrFinderColorVariation',
  'titleColor',
  'groundLeavesSeed',
  'weatherColor',
  'ambientParticleColor',
]);

function escapeJsxAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\r', '&#13;')
    .replaceAll('\n', '&#10;');
}

function formatJsPropertyName(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
    ? key
    : JSON.stringify(key);
}

function formatJsValue(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(formatJsValue).join(', ')}]`;
  }

  const properties = Object.entries(value).map(([key, child]) => (
    `${formatJsPropertyName(key)}: ${formatJsValue(child)}`
  ));
  return `{ ${properties.join(', ')} }`;
}

interface FormattedReactLogo {
  value: string;
  declaration?: string;
}

function formatReactLogo(logo: DesignQRConfigV1['logo']): FormattedReactLogo {
  if (logo === false) return { value: 'false' };

  return {
    value: 'brandLogo',
    declaration: `const brandLogo = {
  src: ${formatJsValue(logo.src)},
  alt: ${formatJsValue(logo.alt)},
  size: ${formatJsValue(logo.size)},
};`,
  };
}

function formatFullThemeParameters(theme: object): string {
  const entries = Object.entries(theme);
  return entries.flatMap(([key, value], index) => {
    const lines = [`  ${formatJsPropertyName(key)}: ${formatJsValue(value)},`];
    if (
      FULL_THEME_SECTION_END_KEYS.has(key)
      && index < entries.length - 1
    ) {
      lines.push('');
    }
    return lines;
  }).join('\n');
}

function createMinimalReactModule(props: string[]): string {
  const component = props.length === 1
    ? `  return <DesignQR ${props[0]} />;`
    : `  return (
    <DesignQR
${props.map((prop) => `      ${prop}`).join('\n')}
    />
  );`;

  return `import { DesignQR } from 'designqr';
import 'designqr/style.css';

export function InteractiveQRCode() {
${component}
}`;
}

function serializeDesignQRSetup(config: DesignQRConfigV1): string {
  return JSON.stringify(Object.fromEntries(
    Object.entries(config).filter(([key]) => key !== 'value')
  ));
}

export function getRecommendedDesignQRReactExample(
  config: DesignQRConfigV1
): DesignQRReactExampleMode {
  const currentConfig = normalizeDesignQRConfig(config);
  if (currentConfig.theme.type === 'custom') return 'theme';

  const defaultConfig = normalizeDesignQRConfig({ value: currentConfig.value });
  return serializeDesignQRSetup(currentConfig) === serializeDesignQRSetup(defaultConfig)
    ? 'simple'
    : 'advanced';
}

export function createDesignQRReactSnippet(config: DesignQRConfigV1): string {
  return createMinimalReactModule([
    `value="${escapeJsxAttribute(config.value)}"`,
  ]);
}

export function createDesignQRAdvancedReactSnippet(config: DesignQRConfigV1): string {
  const logo = formatReactLogo(config.logo);
  const customThemeDeclaration = config.theme.type === 'custom'
    ? `const currentTheme = {
${formatFullThemeParameters(config.theme.value)}
} satisfies TreeTheme;`
    : undefined;
  const props = [
    `value="${escapeJsxAttribute(config.value)}"`,
    `design="${config.design.type}"`,
    `tree={${formatJsValue(config.design.options)}}`,
    config.theme.type === 'preset'
      ? `theme="${config.theme.preset}"`
      : 'theme={currentTheme}',
    'view={view}',
    `details={${formatJsValue(config.details)}}`,
    `interaction={${formatJsValue(config.interaction)}}`,
    `logo={${logo.value}}`,
    `transparentBackground={${config.transparentBackground === true}}`,
    'style={{ width: "100%", maxWidth: 480 }}',
    'ariaLabel="Interactive DesignQR"',
    'onReady={() => setErrorMessage(null)}',
    'onViewChange={setView}',
    'onError={(error) => setErrorMessage(error.message)}',
  ];

  const declarations = [customThemeDeclaration, logo.declaration].filter(Boolean);
  const declarationBlock = declarations.length > 0
    ? `${declarations.join('\n\n')}\n\n`
    : '';
  const treeThemeTypeImport = config.theme.type === 'custom'
    ? ', type TreeTheme'
    : '';

  return `import { useState } from 'react';
import { DesignQR, type DesignQRView${treeThemeTypeImport} } from 'designqr';
import 'designqr/style.css';

${declarationBlock}export function InteractiveQRCode() {
  const [view, setView] = useState<DesignQRView>("${config.view.initial}");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <>
      <DesignQR
${props.map((prop) => `        ${prop}`).join('\n')}
      />
      <button
        type="button"
        onClick={() => setView((current) => current === "design" ? "qr" : "design")}
      >
        {view === "design" ? "Show QR" : "Show tree"}
      </button>
      {errorMessage && <p role="alert">{errorMessage}</p>}
    </>
  );
}`;
}

export function createDesignQRThemeReactSnippet(config: DesignQRConfigV1): string {
  const logo = formatReactLogo(config.logo);
  const logoDeclaration = logo.declaration ? `${logo.declaration}\n\n` : '';
  const basePreset = config.theme.type === 'preset'
    ? config.theme.preset
    : 'spring';
  const fullTheme = resolveTreeTheme(config.theme);

  return `import {
  createTreeTheme,
  DesignQR,
  type ResolvedTreeTheme,
} from 'designqr';
import 'designqr/style.css';

${logoDeclaration}const customTheme = createTreeTheme('${basePreset}', {
${formatFullThemeParameters(fullTheme)}
} satisfies ResolvedTreeTheme);

export function CustomThemeQRCode() {
  return (
    <DesignQR
      value="${escapeJsxAttribute(config.value)}"
      design="${config.design.type}"
      tree={${formatJsValue(config.design.options)}}
      theme={customTheme}
      defaultView="${config.view.initial}"
      details={${formatJsValue(config.details)}}
      interaction={${formatJsValue(config.interaction)}}
      logo={${logo.value}}
      transparentBackground={${config.transparentBackground === true}}
      style={{ width: "100%", maxWidth: 480 }}
      ariaLabel="Interactive DesignQR"
    />
  );
}`;
}
