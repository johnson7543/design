const STYLE_SELECTOR = 'style[data-designqr-core-styles]';

/** Install styles before canvas layout, while respecting host-managed CSS. */
export function ensureDesignQRStyles(css: string, owner: Document): void {
  if (owner.querySelector(STYLE_SELECTOR)) return;

  const probe = owner.createElement('div');
  probe.className = 'designqr-root';
  probe.hidden = true;
  probe.setAttribute('aria-hidden', 'true');
  (owner.body ?? owner.documentElement).append(probe);
  const loaded = owner.defaultView?.getComputedStyle(probe)
    .getPropertyValue('--designqr-core-styles').trim() === 'loaded';
  probe.remove();
  if (loaded) return;

  const style = owner.createElement('style');
  style.setAttribute('data-designqr-core-styles', '');
  const nonce = owner.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.content;
  if (nonce) style.nonce = nonce;
  style.textContent = css;
  // Defaults precede consumer styles, including equal-specificity overrides.
  owner.head.prepend(style);
}
