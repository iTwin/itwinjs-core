---
publish: false
---
# NextVersion

## Txn monitoring

[TxnManager]($backend) now has additional events for monitoring changes to the iModel resulting from [Txns]($docs/learning/InteractiveEditing.md), including:

* [TxnManager.onModelsChanged]($backend) for changes to the properties of [Model]($backend)s and
* [TxnManager.onModelGeometryChanged]($backend) for changes to the geometry contained within [GeometricModel]($backend)s.

[BriefcaseConnection.txns]($frontend) now exposes the same events provided by `TxnManager`, but on the frontend, via [BriefcaseTxns]($frontend).

## New settings UI features

### Add settings tabs and pages to UI

#### Quantity formatting settings

The [QuantityFormatSettingsPage]($ui-framework) component has been added to provide the UI to set both the [PresentationUnitSystem]($presentation-common) and formatting overrides in the [QuantityFormatter]($frontend). This component can be used in the new [SettingsContainer]($ui-core) UI component. The function `getQuantityFormatsSettingsManagerEntry` will return a [SettingsTabEntry]($ui-core) for use by the [SettingsManager]($ui-core).

#### User Interface Settings

The [UiSettingsPage]($ui-framework) component has been to provide the UI to set general UI settings that effect the look and feel of the App UI user interface. This component can be used in the new [SettingsContainer]($ui-core) UI component. The function `getUiSettingsManagerEntry` will return a [SettingsTabEntry]($ui-core) for use by the [SettingsManager]($ui-core).

#### Registering settings

Below is an example of registering the `QuantityFormatSettingsPage` with the `SettingsManager`.

```ts
// Sample settings provider that dynamically adds settings into the setting stage
export class AppSettingsTabsProvider implements SettingsTabsProvider {
  public readonly id = "AppSettingsTabsProvider";

  public getSettingEntries(_stageId: string, _stageUsage: string): ReadonlyArray<SettingsTabEntry> | undefined {
    return [
      getQuantityFormatsSettingsManagerEntry(10, {availableUnitSystems:new Set(["metric","imperial","usSurvey"])}),
      getUiSettingsManagerEntry(30, true),
    ];
  }

  public static initializeAppSettingProvider() {
    UiFramework.settingsManager.addSettingsProvider(new AppSettingsTabsProvider());
  }
}
```

The `QuantityFormatSettingsPage` is marked as alpha in this release and is subject to minor modifications in future releases.

## @bentley/imodeljs-quantity package

The alpha classes, interfaces, and definitions in the package `@bentley/imodeljs-quantity` have been updated to beta.

## Incremental precompilation of shaders enabled by default

To help prevent delays when a user interacts with a [Viewport]($frontend), the WebGL render system now by default precompiles shader programs used by the [RenderSystem]($frontend) before any Viewport is opened.

Shader precompilation will cease once all shader programs have been compiled, or when a [Viewport]($frontend) is opened (registered with the [ViewManager]($frontend)).  As such, applications which do not open a [Viewport]($frontend) immediately upon startup stand to benefit - for example, if the user is first expected to select an iModel and/or a view through the user interface.

To disable this functionality, set the `doIdleWork` property of the `RenderSystem.Options` object passed to `IModelApp.startup` to false.

## Added NativeHost.settingsStore for storing user-level settings for native applications

The @beta class `NativeHost` now has a member [NativeHost.settingsStore]($backend) that may be used by native applications to store user-level data in a file in the [[NativeHost.appSettingsCacheDir]($backend) directory. It uses the [NativeAppStorage]($backend) api to store and load key/value pairs. Note that these settings are stored in a local file that may be deleted by the user, so it should only be used for a local cache of values that may be restored elsewhere.

## NativeApp is now @beta

The class [NativeApp]($frontend) has been promoted from @alpha to @beta. `NativeApp` is relevant for both Electron and mobile applications. Please provide feedback if you have issues or concerns on its use.

## Properly declare changeSetId

There were a number of places where *changeSetId* variables/parameters were incorrectly typed as [GuidString]($bentley) instead of `string`.
A *changeSetId* is a string hash value based on the ChangeSet contents and parent. It is not a GUID.
This is not a breaking change because `GuidString` is just a type alias for `string`.
It was, however, confusing from a usage and documentation perspective and needed to be corrected.

## Promoted APIs

The following APIs have been promoted to `public`. Public APIs are guaranteed to remain stable for the duration of the current major version of a package.

### @bentley/bentleyjs-core

* [assert]($bentleyjs-core) for asserting logic invariants.
* [ProcessDetector]($bentleyjs-core) for querying the type of executing Javascript process.
* [ObservableSet]($bentleyjs-core) for a [Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set) that emits events when its contents are modified.
* [ByteStream]($bentleyjs-core) for extracting data from binary streams.
* Types related to collections of [Id64String]($bentleyjs-core)s
  * [OrderedId64Iterable]($bentleyjs-core) and [OrderedId64Array]($bentleyjs-core)
  * [CompressedId64Set]($bentleyjs-core) and [MutableCompressedId64Set]($bentleyjs-core)

## Breaking API changes

### @bentley/imodeljs-backend package

The arguments for the protected static methods called during modifications:

  [Element]($backend)[onInsert, onInserted, onUpdate, onUpdated, onDelete, onDeleted]
  [Model]($backend)[onInsert, onInserted, onUpdate, onUpdated, onDelete, onDeleted]
  [ElementAspect]($backend)[onInsert, onInserted, onUpdate, onUpdated, onDelete, onDeleted]

Have been changed to be more consistent and extensible.

In addition, new protected static methods were added:

  [Element]($backend)[onChildInsert, onChildInserted, onChildUpdate, onChildUpdated, onChildDelete, onChildDeleted, onChildAdd, onChildAdded, onChildDrop, onChildDropped]
  [Model]($backend)[onInsertElement, onInsertedElement, onUpdateElement, onUpdatedElement, onDeleteElement, onDeletedElement]

These changes only affect implementers of [Schema]($backend) classes. See documentation for details.

### @bentley/ui-core package

The beta class `SettingsProvider` was renamed to `SettingsTabsProvider`.

### @bentley/ui-framework package

The beta class `QuantityFormatSettingsPanel` was renamed to `QuantityFormatSettingsPage`.

### @bentley/imodeljs-quantity package

#### UnitProps property name change

The interface [UnitProps]($quantity) property `unitFamily` has been renamed to `phenomenon` to be consistent with naming in `ecschema-metadata` package.

### @bentley/presentation-components package

Return value of [usePresentationTreeNodeLoader]($presentation-components) hook was changed from

```ts
PagedTreeNodeLoader<IPresentationTreeDataProvider>
```

to

```ts
{
  nodeLoader: PagedTreeNodeLoader<IPresentationTreeDataProvider>;
  onItemsRendered: (items: RenderedItemsRange) => void;
}
```

Callback `onItemsRendered` returned from [usePresentationTreeNodeLoader]($presentation-components) hook should be passed to [ControlledTree]($ui-components) when property `enableHierarchyAutoUpdate` on [PresentationTreeNodeLoaderProps]($presentation-components) is set to true. If hierarchy auto update is not enabled replace:

```ts
const nodeLoader = usePresentationTreeNodeLoader(props);
```

With:

```ts
const { nodeLoader } = usePresentationTreeNodeLoader(props);
```

If hierarchy auto update is enabled replace:

```ts
const nodeLoader = usePresentationTreeNodeLoader(props);
```

With:

```tsx
const { nodeLoader, onItemsRendered } = usePresentationTreeNodeLoader(props);
return <ControlledTree
  onItemsRendered={onItemsRendered}
/>;
```
