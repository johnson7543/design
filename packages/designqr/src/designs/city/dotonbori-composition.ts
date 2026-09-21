import type { DotonboriTemplate } from './dotonbori-assets.ts';

/** Photo-directed hosts retain their dimensions; context uses City QR variation. */
export const DOTONBORI_REFERENCE_HOSTS: Readonly<Record<string, string>> = Object.freeze({
  B031: 'bldg_20d649b2-8ed9-4907-8d04-ad66a6952df4', B034: 'bldg_6b39f217-6938-46f4-be4f-b63dadaf6e73',
  B037: 'bldg_7bf89cd8-a58a-4891-a357-3162812dde2d', B039: 'bldg_23f218a7-b6c5-4dfc-a904-9f53dac5f742',
  B040: 'bldg_dbb9aa26-307a-4437-9ae4-0bf14437c614', B041: 'bldg_8c47976a-840f-413d-9bd8-fd1dfbcaed85',
  B046: 'bldg_bc4a46b3-c8b8-4921-b928-b880430f9d0a',
  B092: 'bldg_62a12ed7-ad07-4a43-8a33-c8720026bbaa',
});

/** B038 is a narrow LOD1 context solid beside the Pip/FANCL wall. Keep its
 * generated roof below that sign stack; this is a miniature height choice,
 * not a correction to the source survey. The footprint and 1F remain intact. */
export const DOTONBORI_CONTEXT_TOP_LIMITS_M: Readonly<Record<string, number>> = Object.freeze({
  'bldg_fd5276cc-91fe-4ca0-a80f-afdbbbcf3b9e': 12,
});

export function hasDotonboriReferenceHost(templates: readonly DotonboriTemplate[], label: string) {
  return templates.some(t => t.id === DOTONBORI_REFERENCE_HOSTS[label.slice(0, 4)]);
}
