---
name: maintain-design-docs
description: Review, create, and update design-owned documentation when repository UI, routes, layout, responsive behavior, visual components, motion, or color roles are implemented or reviewed. Use automatically for design work; do not use for purely nonvisual implementation changes.
---

# Maintain Design Documentation

Keep each implemented design and its documentation synchronized without waiting
for the user to request a documentation pass.

## Resolve ownership first

1. Read `docs/design-registry.json`.
2. Match the affected route and source paths to a registered design.
3. Read that design's index, style document, and color document before changing
   visual behavior. Also read `docs/design-system/colors.md` when colors are in
   scope.
4. Treat shared-source changes as affecting every registered design that
   consumes them; review each applicable document.

If a new route or visual product has no owner, treat it as a new design. Create
its documentation and registry entry as part of the implementation rather than
leaving it undocumented.

## Review and update

After implementation, compare the resulting behavior with the owning docs:

- Update the style document for changed layout, spacing, typography, component
  contracts, interaction states, responsive breakpoints, motion, or
  accessibility behavior.
- Update the design-owned color document for changed color roles, palettes, or
  component assignments. The global registry is usage-neutral and must never
  contain design-specific mappings.
- Update the design index when a maintained design document is added, renamed,
  moved, or retired.
- Create a focused additional document only when the material does not belong
  in the style or color contract, then list it in the design index.

Do not churn documentation for an internal refactor or a bug fix that restores
already-documented behavior. Still review the docs and report that no update was
needed.

## Create a new design contract

Use the files under `assets/` as starting structures, replacing every template
field with repository-specific content:

- `design-index.md.template`
- `style-principles.md.template`
- `color-mappings.md.template`

Create `docs/<design-id>/`, add the design to `docs/design-registry.json`, and
link its index from `docs/README.md`. Register concrete routes and source paths;
do not use broad repository roots as ownership shortcuts.

Document current implemented behavior, not aspirations. Mark speculative
architecture as proposed in a separate document.

## Color boundary

Every repository-authored base color must already exist in
`docs/design-system/colors.md`. A design document may assign approved colors to
roles, but it cannot authorize a new base color. Add a global color only when
the user explicitly requests a repository palette change. Runtime user-selected
colors remain outside the authored allowlist.

## Verification

Run:

```bash
npm run design-docs:check
npm run docs:check
npm run color:check
```

Then run the implementation checks required by `AGENTS.md` in proportion to the
actual code or layout changes.
