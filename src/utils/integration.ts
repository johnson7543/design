import {
  DESIGN_QR_DEFAULTS,
  type DesignQRConfigV1,
} from 'designqr/config';

function escapeJsxAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\r', '&#13;')
    .replaceAll('\n', '&#10;');
}

function formatJsValue(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(formatJsValue).join(', ')}]`;
  }

  const properties = Object.entries(value).map(([key, child]) => {
    const property = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
      ? key
      : JSON.stringify(key);
    return `${property}: ${formatJsValue(child)}`;
  });
  return `{ ${properties.join(', ')} }`;
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

export function createDesignQRReactSnippet(config: DesignQRConfigV1): string {
  const props = [`value="${escapeJsxAttribute(config.value)}"`];

  const tree = {
    ...(config.design.options.shape !== DESIGN_QR_DEFAULTS.design.options.shape
      ? { shape: config.design.options.shape }
      : {}),
    ...(config.design.options.seed !== DESIGN_QR_DEFAULTS.design.options.seed
      ? { seed: config.design.options.seed }
      : {}),
  };
  if (Object.keys(tree).length > 0) {
    props.push(`tree={${formatJsValue(tree)}}`);
  }

  if (config.theme.type === 'custom') {
    props.push(`theme={${formatJsValue(config.theme.value)}}`);
  } else if (config.theme.preset !== DESIGN_QR_DEFAULTS.theme.preset) {
    props.push(`theme="${config.theme.preset}"`);
  }

  if (config.view.initial !== DESIGN_QR_DEFAULTS.view.initial) {
    props.push(`defaultView="${config.view.initial}"`);
  }

  const details = {
    ...(config.details.title !== DESIGN_QR_DEFAULTS.details.title
      ? { title: config.details.title }
      : {}),
    ...(config.details.showValue !== DESIGN_QR_DEFAULTS.details.showValue
      ? { showValue: config.details.showValue }
      : {}),
    ...(config.details.border !== false
      ? { border: config.details.border }
      : {}),
  };
  if (Object.keys(details).length > 0) {
    props.push(`details={${formatJsValue(details)}}`);
  }

  const interaction = {
    ...(config.interaction.dragToRotate !== DESIGN_QR_DEFAULTS.interaction.dragToRotate
      ? { dragToRotate: config.interaction.dragToRotate }
      : {}),
    ...(config.interaction.tapToToggleView !== DESIGN_QR_DEFAULTS.interaction.tapToToggleView
      ? { tapToToggleView: config.interaction.tapToToggleView }
      : {}),
    ...(config.interaction.autoRotate !== DESIGN_QR_DEFAULTS.interaction.autoRotate
      ? { autoRotate: config.interaction.autoRotate }
      : {}),
    ...(config.interaction.motionBlur !== DESIGN_QR_DEFAULTS.interaction.motionBlur
      ? { motionBlur: config.interaction.motionBlur }
      : {}),
  };
  if (Object.keys(interaction).length > 0) {
    props.push(`interaction={${formatJsValue(interaction)}}`);
  }

  if (config.quality !== DESIGN_QR_DEFAULTS.quality) {
    props.push(`quality="${config.quality}"`);
  }

  return createMinimalReactModule(props);
}

export function createDesignQRAdvancedReactSnippet(config: DesignQRConfigV1): string {
  const theme = config.theme.type === 'preset'
    ? `"${config.theme.preset}"`
    : `{${formatJsValue(config.theme.value)}}`;
  const props = [
    `value="${escapeJsxAttribute(config.value)}"`,
    `design="${config.design.type}"`,
    `tree={${formatJsValue(config.design.options)}}`,
    `theme=${theme}`,
    `defaultView="${config.view.initial}"`,
    `details={${formatJsValue(config.details)}}`,
    `interaction={${formatJsValue(config.interaction)}}`,
    `quality="${config.quality}"`,
    'className=""',
    'style={{ width: "100%", maxWidth: 480 }}',
    'ariaLabel="Interactive DesignQR"',
    'onReady={() => console.log("DesignQR ready")}',
    'onViewChange={(view) => console.log("DesignQR view:", view)}',
    'onError={(error) => console.error(error)}',
  ];

  return `import { DesignQR } from 'designqr';
import 'designqr/style.css';

export function InteractiveQRCode() {
  // For controlled view state, replace defaultView with view={view}.
  return (
    <DesignQR
${props.map((prop) => `      ${prop}`).join('\n')}
    />
  );
}`;
}
