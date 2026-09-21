# Documentation conventions

Status: Active repository standard

[Back to global standards](README.md)

- Keep repository setup in the root `README.md` and agent instructions in
  `AGENTS.md`.
- Put shared rules in `docs/global-standards/`, home UI contracts in
  `docs/home-page/`, package contracts in `docs/designqr-package/`, and editor
  UI contracts in `docs/designqr-editor/`.
- Use lowercase kebab-case filenames and a `README.md` index in each area.
  Group large areas by subject; every documentation subfolder needs its own
  index linked from its parent. Supporting-data folders without Markdown
  documents are indexed through their owning source document.
- Give maintained contracts a status, scope, and executable source of truth.
- Link each maintained document from its owning index. Link across areas when
  behavior is shared; keep one authoritative contract rather than duplicating it.
- Keep API usage examples in the package README. Package architecture,
  rendering, asset provenance, research, and release workflows belong in package
  documentation. Retain documents that support future maintenance or
  enhancement: current contracts, architectural decisions, reproducible workflows,
  source evidence, and actionable unresolved requirements. Extract lasting
  guidance from completed plans, then remove milestone logs, superseded proposals,
  and duplicated API examples. Keep open work with its relevant design and state
  clearly what is implemented versus proposed.
- Register routes, source ownership, and required style/color documents in the
  [design registry](../design-registry.json). Shared sources affect every
  consuming area.
- Update inbound links and generator metadata when a document moves.
- Run `npm run docs:check`, `npm run design-docs:check`, and
  `npm run color:check` after a documentation reorganization.
