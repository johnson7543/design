# Documentation

This directory is the entry point for product, design, and architecture
documentation. Repository setup and commands remain in the root `README.md`;
agent instructions remain in the root `AGENTS.md`.

## Shared foundations

| Foundation | Documentation |
| --- | --- |
| Design system | [Global visual contracts](design-system/README.md) |
| Design ownership | [Route, source, and documentation registry](design-registry.json) |

## Products

| Product | Documentation |
| --- | --- |
| Design platform | [Catalog and shared route surfaces](design-platform/README.md) |
| Design QR | [Overview and document index](design-qr/README.md) |

## Workflows

| Workflow | Documentation |
| --- | --- |
| Product demo videos | [Initialize, record, verify, and apply](demo-videos/README.md) |

## Organization rules

- Keep product-specific documents under `docs/<product>/` and shared visual
  foundations under `docs/design-system/`.
- Use lowercase kebab-case filenames.
- Give each maintained document a status and identify its source of truth.
- Add new documents to the relevant product index.
- Register new designs, routes, source ownership, and required documents in
  `design-registry.json`.
- Update local links whenever a document moves; `npm run docs:check` validates
  paths and prevents machine-specific `file://` links.
