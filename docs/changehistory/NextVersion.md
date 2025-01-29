---
publish: false
---

# NextVersion

Table of contents:

- [NextVersion](#nextversion)
  - [Selection set](#selection-set)
  - [Font APIs](#font-apis)
  - [Geometry](#geometry)
    - [Polyface Traversal](#polyface-traversal)
  - [API deprecations](#api-deprecations)
    - [@itwin/core-bentley](#itwincore-bentley)
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
    - [Deprecated API removals](#deprecated-api-removals)
      - [@itwin/appui-abstract](#itwinappui-abstract)
      - [@itwin/core-backend](#itwincore-backend-1)
      - [@itwin/core-bentley](#itwincore-bentley-1)
      - [@itwin/core-electron](#itwincore-electron)
      - [@itwin/core-frontend](#itwincore-frontend-1)
      - [@itwin/core-geometry](#itwincore-geometry)
    - [API removals](#api-removals)
      - [@itwin/core-common](#itwincore-common-1)
    - [Packages dropped](#packages-dropped)
    - [Change to pullMerge](#change-to-pullmerge)
      - [No pending/local changes](#no-pendinglocal-changes)
      - [With pending/local changes](#with-pendinglocal-changes)
    - [TypeScript configuration changes](#typescript-configuration-changes)

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

## Geometry

### Polyface Traversal

Conventional [IndexedPolyface]($core-geometry) data defines each facet by a sequence of point indices around the facet, however these indices do not indicate which facet is adjacent across an edge, nor do they indicate which facets are adjacent at a vertex. The topology of the mesh is incomplete.

The new class [IndexedPolyfaceWalker]($core-geometry) has methods to complete the topology of an `IndexedPolyface` and to navigate these adjacencies. A one-time call to [IndexedPolyfaceWalker.buildEdgeMateIndices]($core-geometry) populates a new optional index array of the [PolyfaceData]($core-geometry). This array stores the cross-edge relationship, and is valid as long as the mesh topology is unchanged. After this step, the following queries support navigation around a facet, around a vertex, and across an edge. Given an `IndexedPolyfaceWalker` object that refers to a particular edge:

- [IndexedPolyfaceWalker.nextAroundFacet]($core-geometry) and [IndexedPolyfaceWalker.previousAroundFacet]($core-geometry) return a walker referring to the next/previous edge around the facet.
- [IndexedPolyfaceWalker.nextAroundVertex]($core-geometry) and [IndexedPolyfaceWalker.previousAroundVertex]($core-geometry) return a walker referring to the next/previous edge around the edges' start vertex.
- [IndexedPolyfaceWalker.edgeMate]($core-geometry) returns a walker referring to the matched edge in the adjacent facet.

If a walker operation would advance outside the mesh (e.g., `edgeMate` of a boundary edge), it returns an invalid walker.

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

  > Note that while public types with deterministic cleanup logic in iTwin.js will continue to implement _both_ `IDisposable` and `Disposable` until the former is fully removed in iTwin.js 7.0 (in accordance with our [API support policy](../learning/api-support-policies)), disposable objects should still only be disposed once - _either_ with [IDisposable.dispose]($core-bentley) _or_ `Symbol.dispose()` but not both! Where possible, prefer `using` declarations or the [dispose]($core-bentley) helper function over directly calling either method.

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

iTwin.js now supports only the latest Electron release (Electron 34) and has dropped support for all older Electron releases. This decision was made because Electron releases major updates much more frequently than iTwin.js and it is difficult to support a high number of major versions.

#### ECMAScript

`@itwin/build-tools` has bumped the [TypeScript compilation target](https://www.typescriptlang.org/tsconfig#target) from [ES2021](https://262.ecma-international.org/12.0/) to [ES2023](https://262.ecma-international.org/14.0/). This means that JavaScript files provided by core packages should be run in [environments supporting ES2023 features](https://compat-table.github.io/compat-table/es2016plus/).

### Deprecated API removals

The following previously-deprecated APIs have been removed:

#### @itwin/appui-abstract

The following APIs have been removed in `@itwin/appui-abstract`.

| **Removed**                         | **Replacement**                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| `AbstractStatusBarActionItem`       | Use `StatusBarActionItem` in `@itwin/appui-react` instead.                             |
| `AbstractStatusBarCustomItem`       | Use `StatusBarCustomItem` in `@itwin/appui-react` instead.                             |
| `AbstractStatusBarItem`             | Use `CommonStatusBarItem` in `@itwin/appui-react` instead.                             |
| `AbstractStatusBarItemUtilities`    | Use `StatusBarItemUtilities` in `@itwin/appui-react` instead.                          |
| `AbstractStatusBarLabelItem`        | Use `StatusBarLabelItem` in `@itwin/appui-react` instead.                              |
| `AbstractWidgetProps`               | Use `Widget` in `@itwin/appui-react` instead.                                          |
| `AllowedUiItemProviderOverrides`    | `AllowedUiItemProviderOverrides` in `@itwin/appui-react`.                              |
| `BackstageActionItem`               | `BackstageActionItem` in `@itwin/appui-react`.                                         |
| `BackstageItem`                     | `BackstageItem` in `@itwin/appui-react`.                                               |
| `BackstageItemType`                 | Use Type Guard instead.                                                                |
| `BackstageItemsChangedArgs`         | N/A                                                                                    |
| `BackstageItemsManager`             | N/A                                                                                    |
| `BackstageItemUtilities`            | `BackstageItemUtilities` in `@itwin/appui-react`.                                      |
| `BackstageStageLauncher`            | `BackstageStageLauncher` in `@itwin/appui-react`.                                      |
| `BaseUiItemsProvider`               | `BaseUiItemsProvider` in `@itwin/appui-react`.                                         |
| `CommonBackstageItem`               | `CommonBackstageItem` in `@itwin/appui-react`.                                         |
| `CommonStatusBarItem`               | Use `StatusBarItem` in `@itwin/appui-react` instead.                                   |
| `createSvgIconSpec`                 | Use `IconSpecUtilities.createWebComponentIconSpec()` instead.                          |
| `EditorPosition.columnSpan`         | N/A                                                                                    |
| `getSvgSource`                      | Use `IconSpecUtilities.getWebComponentSource()` instead.                               |
| `isAbstractStatusBarActionItem`     | Use `isStatusBarActionItem` in `@itwin/appui-react` instead.                           |
| `isAbstractStatusBarCustomItem`     | Use `isStatusBarCustomItem` in `@itwin/appui-react` instead.                           |
| `isAbstractStatusBarLabelItem`      | Use `isStatusBarLabelItem` in `@itwin/appui-react` instead.                            |
| `isActionItem`                      | Use `isBackstageActionItem` in `@itwin/appui-react` instead.                           |
| `isStageLauncher`                   | Use `isBackstageStageLauncher` in `@itwin/appui-react` instead.                        |
| `ProvidedItem`                      | `ProvidedItem` in `@itwin/appui-react`.                                                |
| `StagePanelLocation`                | `StagePanelLocation` in `@itwin/appui-react`.                                          |
| `StagePanelSection`                 | `StagePanelSection` in `@itwin/appui-react`.                                           |
| `StageUsage`                        | `StageUsage` in `@itwin/appui-react`.                                                  |
| `StatusBarItemId`                   | Use `CommonStatusBarItem` in `@itwin/appui-react` instead.                             |
| `StatusBarLabelSide`                | `StatusBarLabelSide` in `@itwin/appui-react`.                                          |
| `StatusBarSection`                  | `StatusBarSection` in `@itwin/appui-react`.                                            |
| `ToolbarItemId`                     | Use `ToolbarItem["id"]` in `@itwin/appui-react` instead.                               |
| `ToolbarManager`                    | For replacement, check [here]($docs/ui/appui/provide-ui-items/#provide-toolbar-items). |
| `ToolbarOrientation`                | `ToolbarOrientation` in `@itwin/appui-react`.                                          |
| `ToolbarUsage`                      | `ToolbarUsage` in `@itwin/appui-react`.                                                |
| `UiItemProviderRegisteredEventArgs` | `UiItemProviderRegisteredEventArgs` in `@itwin/appui-react`.                           |
| `UiItemProviderOverrides`           | `UiItemProviderOverrides` in `@itwin/appui-react`.                                     |
| `UiItemsApplicationAction`          | N/A                                                                                    |
| `UiItemsManager`                    | `UiItemsManager` in `@itwin/appui-react`.                                              |
| `UiItemsProvider`                   | `UiItemsProvider` in `@itwin/appui-react`.                                             |
| `WidgetState`                       | `WidgetState` in `@itwin/appui-react`.                                                 |

#### @itwin/core-backend

| Removed               | Replacement |
| --------------------- | ----------- |
| `IModelDb.nativeDb`   | N/A         |
| `ECDb.nativeDb`       | N/A         |
| `SQLiteDb.nativeDb`   | N/A         |
| `IModelHost.platform` | N/A         |

All three `nativeDb` fields and `IModelHost.platform` have always been `@internal`. Use the `@public` APIs instead. If some functionality is missing from those APIs, [let us know](https://github.com/iTwin/itwinjs-core/issues/new?template=feature_request.md).

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

#### @itwin/core-electron

| Removed                             | Replacement                                               |
| ----------------------------------- | --------------------------------------------------------- |
| `ElectronApp.callDialog`            | [ElectronApp.dialogIpc]($electron)                        |
| `ElectronHost.getWindowSizeSetting` | [ElectronHost.getWindowSizeAndPositionSetting]($electron) |


#### @itwin/core-frontend

| **Removed**                               | **Replacement**                                                                                              |
|-------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| `callIpcHost`                             | Use `appFunctionIpc` instead.                                                                                 |
| `callNativeHost`                          | Use `nativeAppIpc` instead.                                                                                   |
| `createMaterial`                          | Use `createRenderMaterial` instead.                                                                           |
| `createTextureFromImage`                  | Use `createTexture` instead.                                                                                  |
| `createTextureFromImageBuffer`            | Use `createTexture` instead.                                                                                  |
| `createTextureFromImageSource`            | Use `RenderSystem.createTextureFromSource` instead.                                                           |
| `GraphicBuilder.pickId`                   | Deprecated in 3.x. Maintain the current pickable ID yourself.                                                 |
| `getDisplayedExtents`                     | These extents are based on `IModelConnection.displayedExtents`. Consider `computeFitRange` or `getViewedExtents`. |
| `IModelConnection.displayedExtents`       | N/A                                                                                                          |
| `IModelConnection.expandDisplayedExtents` | Use `displayedExtents` instead.                                                                               |
| `IModelConnection.query`                  | Use `createQueryReader` instead (same parameter).                                                           |
| `IModelConnection.queryRowCount`          | Count the number of results using `count(*)` with a subquery, e.g., `SELECT count(*) FROM (<original-query>)`. |
| `IModelConnection.restartQuery`           | Use `createQueryReader`. Pass the restart token in the `config` argument, e.g., `{ restartToken: myToken }`. |
| `requestDownloadBriefcase(progress)`      | `progress` is removed, use `DownloadBriefcaseOptions.progressCallback` instead.                             |
| `readImage`                               | Use `readImageBuffer` instead.                                                                                |
| `setEventController`                      | Removed (was for internal use).                                                                               |
| `PullChangesOptions.progressCallback`     | Use `downloadProgressCallback` instead.                                                                      |

#### @itwin/core-geometry

| Removed               | Replacement |
| --------------------- | ----------- |
| `PathFragment.childFractionTChainDistance`        | `PathFragment.childFractionToChainDistance` |
| `GrowableXYArray.setXYZAtCheckedPointIndex`       | `GrowableXYArray.setXYAtCheckedPointIndex`  |
| `PolyfaceBuilder.findOrAddPoint`                  | `PolyfaceBuilder.addPoint`                  |
| `PolyfaceBuilder.findOrAddParamXY`                | `PolyfaceBuilder.addParamXY`                |
| `PolyfaceBuilder.findOrAddParamInGrowableXYArray` | `PolyfaceBuilder.addParamInGrowableXYArray` |
| `PolyfaceBuilder.findOrAddPointXYZ`               | `PolyfaceBuilder.addPointXYZ`               |

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

| Removed                        | Replacement                                                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@itwin/backend-webpack-tools` | Previously we recommended bundling backends via tools like webpack to decrease the deployed backend size, however we no longer recommend bundling backends at all.                                      |
| `@itwin/core-telemetry`        | No consumable APIs were being published therefore this package has been removed, with no replacement available. Please implement your own telemetry client. |
| `@itwin/core-webpack-tools`    | We no longer recommend using [webpack](https://webpack.js.org/) and instead recommend using [Vite](https://vite.dev/).                                      |

### Change to pullMerge

Starting from version 5.x, iTwin.js has transitioned from using the merge method to using the rebase + fast-forward method for merging changes. This change is transparent to users and is enabled by default.

#### No pending/local changes

- Incoming changes are applied using "fast-forward" method.

#### With pending/local changes

The merging process in this method follows these steps:

1. Initially, each incoming change is attempted to be applied using the _fast-forward_ method. If successful, the process is complete.
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

### TypeScript configuration changes

There are number of changes made to base TypeScript configuration available in `@itwin/build-tools` package.

#### `target`

[`target`](https://www.typescriptlang.org/tsconfig/#target) is now set to `ES2023` instead of `ES2021`.

#### `useDefineForClassFields`

Starting `ES2022`, Typescript compile flag [`useDefineForClassFields`](https://www.typescriptlang.org/tsconfig/#useDefineForClassFields) defaults to `true` ([TypeScript release notes on `useDefineForClassFields` flag](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#the-usedefineforclassfields-flag-and-the-declare-property-modifier)).

This may cause issues for classes which have [Entity]($backend) class as an ancestor and initialize their properties using [Entity]($backend) constructor (note: example uses simplified [Element]($backend) class):
```ts
interface MyElementProps extends ElementProps {
  property: string;
}

class MyElement extends Element {
  public property!: string;

  constructor(props: MyElementProps) {
    super(props);
  }
}

const myElement = new MyElement({ property: "value" });
console.log(myElement.property); // undefined
```

To fix this, you can either initialize your properties in your class constructor:

```ts
class MyElement extends Element {
  public property: string;

  constructor(props: MyElementProps) {
    super(props);
    property = props.property;
  }
}
```

or just define your properties using `declare` keyword:

```ts
class MyElement extends Element {
  declare public property: string;
  ...
}
```
