---
publish: false
---

# NextVersion

Table of contents:

- [API deprecations](#api-deprecations)
  - [@itwin/presentation-common](#itwinpresentation-common)
- [Breaking Changes](#breaking-changes)
  - [Opening connection to local snapshot requires IPC](#opening-connection-to-local-snapshot-requires-ipc)
  - [Updated minimum requirements](#updated-minimum-requirements)
    - [Node.js](#nodejs)
    - [Electron](#electron)
    - [ECMAScript](#ecmascript)
  - [Deprecated API removals](#deprecated-api-removals)

## API deprecations

### @itwin/presentation-common

- All public methods of [PresentationRpcInterface]($presentation-common) have been deprecated. Going forward, RPC interfaces should not be called directly. Public wrappers such as [PresentationManager]($presentation-frontend) should be used instead.

## Breaking Changes

### Opening connection to local snapshot requires IPC

[SnapshotConnection.openFile]($frontend) now requires applications to have set up a valid IPC communication. If you're using this API in an Electron or Mobile application, no additional action is needed as long as you call `ElectronHost.startup` or `MobileHost.startup` respectively. This API shouldn't be used in Web applications, so it has no replacement there.

### Updated minimum requirements

A new major release of iTwin.js affords us the opportunity to update our requirements to continue to provide modern, secure, and rich libraries. Please visit our [Supported Platforms](../learning/SupportedPlatforms) documentation for a full breakdown.

#### Node.js

Node 18 will reach [end-of-life](https://github.com/nodejs/release?tab=readme-ov-file#release-schedule) soon and will no longer be supported. iTwin.js 5.0 requires a minimum of Node 20.9.0, though we recommend using the latest long-term-support version.

#### Electron

iTwin.js now supports only the latest Electron release (Electron 33) and has dropped support for all older Electron releases. This decision was made because Electron releases major updates much more frequently than iTwin.js and it is difficult to support a high number of major versions.

#### ECMAScript

`@itwin/build-tools` has bumped the [TypeScript compilation target](https://www.typescriptlang.org/tsconfig#target) from [ES2021](https://262.ecma-international.org/12.0/) to [ES2023](https://262.ecma-international.org/14.0/). This means that JavaScript files provided by core packages should be run in [environments supporting ES2023 features](https://compat-table.github.io/compat-table/es2016plus/).

### Deprecated API removals

The following previously-deprecated APIs have been removed:

#### @itwin/appui-abstract

| Removed                     | Replacement |
| --------------------------- | ----------- |
| `EditorPosition.columnSpan` | N/A         |

#### @itwin/core-electron

| Removed                             | Replacement                                               |
| ----------------------------------- | --------------------------------------------------------- |
| `ElectronApp.callDialog`            | [ElectronApp.dialogIpc]($electron)                        |
| `ElectronHost.getWindowSizeSetting` | [ElectronHost.getWindowSizeAndPositionSetting]($electron) |
