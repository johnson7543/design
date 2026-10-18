# Pullground documentation

Pullground is a reusable React pull-action component with tiny basketball,
dart, bowling, and stone skipping interactions and a clean demo at `/pullground`. The `onPull` callback runs
synchronous or async actions, including local state changes and data loading.
Stable `@johnson7543/pullground@0.1.0` is published on npm's `latest` channel,
with a verified [live demo](https://design.johnson7543.com/pullground).
The [stable release record](releases/0-1-0.md) identifies the source, archive,
provenance, installation checks, and production deployment. The earlier
`0.1.0-rc.1` prerelease remains available on `next`.

| Document | Status | Purpose |
| --- | --- | --- |
| [Interface style principles](style-principles.md) | Active | Layout, artwork, input, accessibility, and motion |
| [Color mappings](color-mappings.md) | Active | Package, demo, and preview color ownership |
| [Architecture and verification](architecture.md) | Active | Lifecycle, integration, and reproducible checks |
| [First release plan](release-plan.md) | Completed | `0.1.0` scope, readiness gates, npm publication, and demo launch |
| [Release procedure](releasing.md) | Active | Consumer documentation checks, retained archives, and publishing workflow |
| [Release records](releases/README.md) | Active | Exact source, archive checksums, qualification, and publication evidence |
| [Release notes](release-notes.md) | Published | Consumer-facing changes in the first stable release and prerelease |
| [Shared demo UI standard](../global-standards/demo-ui.md) | Active | DesignQR-based chrome and controls used by every demo |

Basketball is the default; the demo's bottom bar switches between Basketball,
Dart, Bowling, and Stone skipping, with Classic, Simple, Ocean, and Midnight palettes in a shared DesignQR theme-chip row.
Consumers select the interaction and palette through `game` and `theme`. These maintained
contracts replace the build plan and the earlier mixed-concept handoff; no
prototype or earlier plan is needed for maintenance.

## Sources of truth

| Concern | Source |
| --- | --- |
| API and usage | [Package README](../../packages/pullground/README.md) and [types](../../packages/pullground/src/types.ts) |
| Component | [Pullground](../../packages/pullground/src/Pullground.tsx) |
| Styles and tokens | [Package CSS](../../packages/pullground/src/style.css) |
| Demo | [Page](../../src/pullground/PullgroundPage.tsx) and [styles](../../src/pullground/pullground-demo.css) |
| Demo palettes | [Theme mappings](../../src/pullground/pullground-themes.css), scoped to the Pullground page |
| Catalog video | [Recording scenario](../../scripts/demo-video-scenarios/pullground.json), following the [demo-video workflow](../demo-videos/README.md) |
| Shared demo chrome | [`src/demo-ui/`](../../src/demo-ui), shared with DesignQR |
| Shared GitHub control | [GitHubLink](../../src/components/GitHubLink.tsx), also used by DesignQR |
| Export dialog | [ExportModal](../../src/pullground/ExportModal.tsx), using DesignQR's modal styles |
| Copyable React examples | [Basketball](../../src/pullground/react-example.tsx), [Dart](../../src/pullground/react-dart-example.tsx), [Bowling](../../src/pullground/react-bowling-example.tsx), [Stone skipping](../../src/pullground/react-stone-example.tsx), [theme generator](../../src/pullground/react-example-source.ts), and [copy interface](../../src/pullground/ReactExample.tsx) |
| Shared code renderer | [CodeView](../../src/components/CodeView.tsx), also used by DesignQR's Share modal |
| Consumer | [Fixture](../../examples/pullground-consumer) |
| Globally permitted colors | [Repository color registry](../global-standards/colors.md) |
| Agent enforcement | [Repository instructions](../../AGENTS.md) |
