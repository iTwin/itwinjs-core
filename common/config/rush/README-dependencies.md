# Managing dependencies

This repository uses Rush and pnpm to manage its packages. Do not edit versions for internal monorepo dependencies; CI maintains them.

## Updating an external dependency

1. If its `package.json` declaration uses `catalog:<name>`, update the corresponding `globalCatalogs.<name>` entry in [`pnpm-config.json`](./pnpm-config.json). Otherwise, update the version range in the owning `package.json`.
2. Run `rush check` and `rush update` from the repository root.
3. For catalog changes, verify that Rush's packed packages contain ordinary version ranges instead of `catalog:` references.

When adding a dependency that is already cataloged, use its existing catalog reference. Rush generates the pnpm workspace configuration; do not edit `common/temp/pnpm-workspace.yaml` manually.

## Catalogs

Shared dependency ranges are defined in `globalCatalogs` in [`pnpm-config.json`](./pnpm-config.json). Package manifests reference them with `catalog:<name>`.

| Catalog | Dependencies |
| --- | --- |
| `auth-clients` | Browser, Electron, and service authorization clients, plus the OIDC sign-in tool, owned by the auth-clients project |
| `build` | TypeScript, file and CLI utilities, and related typings |
| `bundling` | Bundlers, loaders, plugins, and browser polyfills |
| `electron` | App/test Electron baseline; supported peer ranges remain explicit |
| `imodels-clients` | iModels access/client and object-storage packages, which share a maintaining team |
| `itwins-client` | The external iTwins service client |
| `linting` | ESLint, its shared plugin/parser, and formatting tools |
| `presentation` | External presentation packages and their shared RxJS baseline |
| `reality-capture` | The reality-data client owned by the reality-capture project |
| `schemas` | Bentley schema packages used by tests and examples |
| `testing` | Test libraries and typings, environment setup, coverage, and services |
| `types` | Typings for runtime libraries that are not cataloged yet |
| `utilities` | Shared fs-extra, lodash, and semver libraries and their typings |

External iTwin client catalogs follow maintaining-team or release-project ownership, not the npm scope alone. The shared `imodels-clients` catalog covers both the `iTwin/imodels-clients` and `iTwin/object-storage` repositories. Third-party dependencies such as `@azure/storage-blob` do not belong in that owner catalog merely because an iTwin client uses them. The presentation catalog also holds the shared RxJS version policy managed by the presentation area; this does not imply ownership of the upstream RxJS projects.

Keep a library's typings in the same catalog as the library. When cataloging a runtime library, move any corresponding entry out of the remaining `types` catalog too.

The Electron catalog selects the app/test runtime, not the supported host range. Keep the Electron peers in `core/electron` and `tools/certa` explicit, as well as the optional Mocha peer in `tools/build`. Peer ranges describe consumer compatibility rather than the development toolchain baseline.

## Preferred versions and overrides

Catalogs do not replace preferred versions, overrides, or pnpm hooks. Keep the TypeScript, `@types/node`, and `@types/chai` catalog ranges coordinated with their literal preferred versions in [`common-versions.json`](./common-versions.json). The corresponding `allowedAlternativeVersions` entries permit their catalog references without weakening the SemVer preferences used for transitive dependencies. For TypeScript upgrades, also update the API Extractor override in [`.pnpmfile.cjs`](./.pnpmfile.cjs) to match the `build` catalog range.

When moving a dependency into a catalog, review the lockfile's transitive snapshots as well as its package versions. Catalog references can stop Rush's implicit preferred-version rules from applying to wildcard dependencies; preserve an intentional baseline with an explicit preferred version when necessary.

For the dependency review policy, see [Approved Packages Policy](./README-approved-packages.md).
