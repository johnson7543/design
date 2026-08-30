# Design platform documentation

The Design platform owns the catalog home at `/`, shared route-loading surface,
and fallback/not-found experience.

| Document | Status | Purpose |
| --- | --- | --- |
| [Interface style principles](style-principles.md) | Active | Layout, catalog, shared header/footer, responsive, and interaction contracts |
| [Color mappings](color-mappings.md) | Active | Platform-owned semantic color roles and brand-asset assignments |

## Sources of truth

| Concern | Source |
| --- | --- |
| Routes and metadata | [`src/platform/DesignPlatform.tsx`](../../src/platform/DesignPlatform.tsx) |
| Home and fallback components | [`src/platform/`](../../src/platform) |
| Platform styles | [`src/platform.css`](../../src/platform.css) |
| Shared tokens | [`src/styles/design-tokens.css`](../../src/styles/design-tokens.css) |
| Globally permitted colors | [Repository color registry](../design-system/colors.md) |
| Agent enforcement | [`AGENTS.md`](../../AGENTS.md) |
