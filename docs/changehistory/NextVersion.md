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
  - [Deprecated API removals](#deprecated-api-removals)
    - [@itwin/appui-abstract](#itwinappui-abstract)
    - [@itwin/core-electron](#itwincore-electron)
  - [Packages dropped](#packages-dropped)

## API deprecations

### @itwin/core-bentley

- The [IDisposable]($core-bentley) interface, along with related [isIDisposable]($core-bentley) and [using]($core-bentley) utilities, have been deprecated in favor of [TypeScript's built-in](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html#using-declarations-and-explicit-resource-management) `Disposable` type and `using` declarations (from the upcoming [Explicit Resource Management](https://github.com/tc39/proposal-explicit-resource-management) feature in ECMAScript).

  For example, the following:
  ```typescript
    import { using } from "@itwin/core-bentley";
    export function doSomeWork() {
      using(new SomethingDisposable(), (temp) => {
        // do something with temp
      });
    }
  ```
  should now be rewritten as:
  ```typescript
    export function doSomeWork() {
      using temp = new SomethingDisposable();
      // do something with temp
    }
  ```

  > Note that while public types with deterministic cleanup logic in iTwin.js will continue to implement _both_ `IDisposable` and `Disposable` until the former is fully removed in iTwin.js 7.0 (in accordance with our [API support policy](../learning/api-support-policies)), disposable objects should still only be disposed once - _either_ with [IDisposable.dispose]($core-bentley) _or_ `Symbol.dispose()` but not both!  Where possible, prefer `using` declarations or the [dispose]($core-bentley) helper function over directly calling either method.

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

### Packages dropped

As of iTwin.js 5.0, the following packages have been removed and are no longer available:

| Removed                        | Replacement                                               |
| ------------------------------ | --------------------------------------------------------- |
| `@itwin/core-webpack-tools`    | We no longer recommend using [webpack](https://webpack.js.org/) and instead recommend using [Vite](https://vite.dev/). |
| `@itwin/backend-webpack-tools` | We no longer recommend webpack-ing backends, which was previously recommended to shrink the size of backends. |
