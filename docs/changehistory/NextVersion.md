---
publish: false
---

# NextVersion

Table of contents:

- [Selection set](#selection-set)
- [Font APIs](#font-apis)
- [API deprecations](#api-deprecations)
  - [@itwin/core-common](#itwincore-common)
  - [@itwin/core-backend](#itwincore-backend)
  - [@itwin/core-frontend](#itwincore-frontend)
  - [@itwin/presentation-common](#itwinpresentation-common)
- [Breaking Changes](#breaking-changes)
  - [Opening connection to local snapshot requires IPC](#opening-connection-to-local-snapshot-requires-ipc)
  - [Updated minimum requirements](#updated-minimum-requirements)
    - [Node.js](#nodejs)
    - [Electron](#electron)
    - [ECMAScript](#ecmascript)
  - [Deprecated API removals](#deprecated-api-removals) - [@itwin/core-backend](#itwincore-backend-1) - [@itwin/core-common](#itwincore-common-1) - [@itwin/core-bentley](#itwincore-bentley) - [@itwin/appui-abstract](#itwinappui-abstract) - [@itwin/core-electron](#itwincore-electron)
  - [API removals](#api-removals)
  - [Packages dropped](#packages-dropped)
- [Change to pull/merge method](#change-to-pullmerge)

## Selection set

There are two similar selection-related concepts in `@itwin/core-frontend` - [SelectionSet]($core-frontend) and [HiliteSet]($core-frontend). The former is generally used by interactive tools (e.g. the "Move element" tool), so it contains what tools think is selected. The latter is used by the graphics system to know what elements to highlight, so it contains what users think is selected. Generally, we want the two sets to be in sync to avoid confusion why tools act on different elements than what users think are selected. Keeping them in sync was not always possible, because `HiliteSet` may store Model and SubCategory ids, but `SelectionSet` could only store Element ids. So we could end up in situations where a Model id is added to `HiliteSet` and `SelectionSet` is empty, making users think that all elements in that model are selected, but tools not knowing anything about it.

To alleviate this problem, the `SelectionSet`-related APIs have been enhanced to support storing Model and SubCategory ids, similar to what `HiliteSet` does. The change has been made in a backwards compatible way, so all existing code using `SelectionSet` should continue to work as before:

- `SelectionSet` modification methods `add`, `addAndRemove`, `remove`, `replace` now, in addition to existing `Id64Arg` argument, accept the `SelectableIds` structure.
- `SelectionSetEvent` attributes `added` and `removed` have been deprecated, but continue to work as before, containing only element ids. In addition, the event object now contains new `additions` and `removals` attributes, which are instances of `SelectableIds` and contain all ids that were added or removed from the selection set, including those of Model and SubCategory.

Because the `SelectionSet` now stores additional types of ids, existing code that listens to `onChange` event may start getting extra invocations that don't affect the element selection (e.g. `SelectAddEvent` with `added: []` and `additions: { models: ["0x1"] }`). Also, the `isActive` getter may return `true` even though `elements` set is empty.

## Font APIs

[Fonts](../learning/backend/Fonts.md) control the appearance and layout of [TextAnnotation]($common)s. To apply a font to text stored in a [GeometryStream](../learning/common/GeometryStream.md), the font must first be embedded into the iModel. Two new APIs permit you to work with fonts:

- [FontFile]($backend) represents a font obtained from a digital representation like a file on disk.
- [IModelDb.fonts]($backend) permits you to read and write font-related information, including [FontFile]($backend)s, into an [IModelDb]($backend).

Consult the [learning article](../learning/backend/Fonts.md) for details and example code.

## API deprecations

### @itwin/core-common

- [FontMap]($common) attempts to provide an in-memory cache mapping [FontId]($common)s to [Font](../learning/backend/Fonts.md) names. Use [IModelDb.fonts]($backend) instead.

### @itwin/core-backend

- Use [IModelDb.fonts]($backend) instead of [IModelDb.fontMap]($backend).

### @itwin/core-frontend

- Deprecated [SelectionSet]($core-frontend)-related APIs:

  - `SelectionSet.has` and `SelectionSet.isSelected` - use `SelectionSet.elements.has(id)` instead.
  - `SelectionSetEvent.added` and `SelectionSetEvent.removed` - use `SelectionSetEvent.additions.elements` and `SelectionSetEvent.removals.elements` instead.

- Deprecated [HiliteSet.setHilite]($core-frontend) - use `add`, `remove`, `replace` methods instead.

- [IModelConnection.fontMap]($frontend) caches potentially-stale mappings of [FontId]($common)s to font names. If you need access to font Ids on the front-end for some reason, implement an [Ipc method](../learning/IpcInterface.md) that uses [IModelDb.fonts]($backend).

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

#### @itwin/core-backend

| Removed               | Replacement |
| --------------------- | ----------- |
| `IModelDb.nativeDb`   | N/A         |
| `ECDb.nativeDb`       | N/A         |
| `SQLiteDb.nativeDb`   | N/A         |
| `IModelHost.platform` | N/A         |

All three `nativeDb` fields and `IModelHost.platform` have always been `@internal`. Use the `@public` APIs instead. If some functionality is missing from those APIs, [let us know](https://github.com/iTwin/itwinjs-core/issues/new?template=feature_request.md).

#### @itwin/core-common

| Removed                                        | Replacement                       |
| ---------------------------------------------- | --------------------------------- |
| `CodeSpec.isManagedWithIModel`                 | `CodeSpec.scopeReq`               |
| `FeatureOverrides.overrideModel`               | `FeatureOverrides.override`       |
| `FeatureOverrides.overrideSubCategory`         | `FeatureOverrides.override`       |
| `FeatureOverrides.overrideElement`             | `FeatureOverrides.override`       |
| `Localization.getLocalizedStringWithNamespace` | `Localization.getLocalizedString` |
| `TerrainProviderName`                          | N/A                               |

#### @itwin/core-bentley

| Removed                    | Replacement                                                 |
| -------------------------- | ----------------------------------------------------------- |
| `ByteStream constructor`   | `ByteStream.fromUint8Array` or `ByteStream.fromArrayBuffer` |
| `ByteStream.nextUint8`     | `ByteStream.readUint8`                                      |
| `ByteStream.nextUint16`    | `ByteStream.readUint16`                                     |
| `ByteStream.nextUint32`    | `ByteStream.readUint32`                                     |
| `ByteStream.nextInt32`     | `ByteStream.readInt32`                                      |
| `ByteStream.nextFloat32`   | `ByteStream.readFloat32`                                    |
| `ByteStream.nextFloat64`   | `ByteStream.readFloat64`                                    |
| `ByteStream.nextId64`      | `ByteStream.readId64`                                       |
| `ByteStream.nextUint24`    | `ByteStream.readUint32`                                     |
| `TransientIdSequence.next` | `TransientIdSequence.getNext`                               |

#### @itwin/appui-abstract

| Removed                     | Replacement |
| --------------------------- | ----------- |
| `EditorPosition.columnSpan` | N/A         |

#### @itwin/core-electron

| Removed                             | Replacement                                               |
| ----------------------------------- | --------------------------------------------------------- |
| `ElectronApp.callDialog`            | [ElectronApp.dialogIpc]($electron)                        |
| `ElectronHost.getWindowSizeSetting` | [ElectronHost.getWindowSizeAndPositionSetting]($electron) |

### API removals

The following APIs have been removed:

#### @itwin/core-common

The following APIs were re-exported from `@itwin/core-bentley` and have been removed. Please import from `@itwin/core-bentley` instead.

| Removed               |
| --------------------- |
| `BentleyStatus`       |
| `BentleyError`        |
| `IModelStatus`        |
| `BriefcaseStatus`     |
| `DbResult`            |
| `ChangeSetStatus`     |
| `GetMetaDataFunction` |
| `LogFunction`         |
| `LoggingMetaData`     |

### Packages dropped

As of iTwin.js 5.0, the following packages have been removed and are no longer available:

| Removed                        | Replacement                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `@itwin/core-webpack-tools`    | We no longer recommend using [webpack](https://webpack.js.org/) and instead recommend using [Vite](https://vite.dev/). |
| `@itwin/backend-webpack-tools` | We no longer recommend webpack-ing backends, which was previously recommended to shrink the size of backends.          |

### Change to pullMerge

Starting from version 5.x, iTwin.js has transitioned from using the merge method to using the rebase + fastforward method for merging changes. This change is transparent to users and is enabled by default.

#### No pending/local changes

- Incomming changes are applied using "fast-forward" method.

#### With pending/local changes

The merging process in this method follows these steps:

1. Initially, each incoming change is attempted to be applied using the _fastforward_ method. If successful, the process is complete.
2. If the fast-forward method fails for any incoming change, that changeset is abandoned and the rebase method is used instead.
3. The rebase process is executed as follows:
   - All local transactions are reversed.
   - All incoming changesets are applied using the fast-forward method.
   - Local transactions are reinstated one by one, with any conflicts reported to the TxnManager.
   - Once a local changeset is rebased, the local transaction is updated with the rebased changeset.

This method offers several advantages:

1. It allows applications to resolve conflicts effectively.
2. Even after the pull/merge process, applications can still undo/redo their local transactions.
3. The chances of pushing a corrupt changeset are minimal because the rebase process captures modified merge changesets without altering data outside the change tracking session.
4. In the future, this method will be essential for lock-less editing as it enables applications to merge changes with domain intelligence.

For more information read [Pull merge & conflict resolution](../learning/backend/PullMerge.md)
