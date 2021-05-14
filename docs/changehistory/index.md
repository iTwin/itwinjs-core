# 2.15.0 Change Notes

## Clipping enhancements

The contents of a [ViewState]($frontend) can be clipped by applying a [ClipVector]($geometry-core) to the view via [ViewState.setViewClip]($frontend). Several enhancements have been made to this feature:

### Colorization

[ClipStyle.insideColor]($common) and [ClipStyle.outsideColor]($common) can be used to colorize geometry based on whether it is inside or outside of the clip volume. If the outside color is defined, then that geometry will be drawn in the specified color instead of being clipped. These properties replace the beta [Viewport]($frontend) methods `setInsideColor` and `setOutsideColor` and are saved in the [DisplayStyle]($backend).

### Model clip groups

[ModelClipGroups]($common) can be used to apply additional clip volumes to groups of models. Try it out with an [interactive demo](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=swiping-viewport-sample). Note that [ViewFlags.clipVolume]($common) applies **only** to the view clip - model clips apply regardless of view flags.

### Nested clip volumes

Clip volumes now nest. For example, if you define a view clip, a model clip group, and a schedule script that applies its own clip volume, then geometry will be clipped by the **intersection** of all three clip volumes. Previously, only one clip volume could be active at a time.

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

## @bentley/imodeljs-quantity

The alpha classes, interfaces, and definitions in the package `@bentley/imodeljs-quantity` have been updated to beta.

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

### [@bentley/bentleyjs-core](https://www.itwinjs.org/reference/bentleyjs-core/)

* [assert]($bentleyjs-core) for asserting logic invariants.
* [ProcessDetector]($bentleyjs-core) for querying the type of executing JavaScript process.
* [ObservableSet]($bentleyjs-core) for a [Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set) that emits events when its contents are modified.
* [ByteStream]($bentleyjs-core) for extracting data from binary streams.
* Types related to collections of [Id64String]($bentleyjs-core)s
  * [OrderedId64Iterable]($bentleyjs-core) and [OrderedId64Array]($bentleyjs-core)
  * [CompressedId64Set]($bentleyjs-core) and [MutableCompressedId64Set]($bentleyjs-core)

### [@bentley/hypermodeling-frontend](https://www.itwinjs.org/reference/hypermodeling-frontend/)

All hyper-modeling APIs are now public. [This interactive sample](https://www.itwinjs.org/sample-showcase/?group=Viewer&sample=hypermodeling-sample&imodel=House+Sample) demonstrates how to use hyper-modeling features.

### [@bentley/imodeljs-common](https://www.itwinjs.org/reference/imodeljs-common/)

* [ThematicDisplay]($common) for colorizing a [Viewport]($frontend)'s scene based on aspects of the rendered geometry. [This interactive sample](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=thematic-display-sample&imodel=CoffsHarborDemo) demonstrates the usage of thematic display.
* [Tween]($common) for smooth interpolation of values (based on [Tween.js](https://github.com/tweenjs/tween.js/blob/master/docs/user_guide.md))

### [@bentley/imodeljs-frontend](https://www.itwinjs.org/reference/imodeljs-frontend/)

* [ViewGlobeSatelliteTool]($frontend), [ViewGlobeBirdTool]($frontend), [ViewGlobeLocationTool]($frontend), [ViewGlobeIModelTool]($frontend) for viewing the iModel in a global context.
* [MeasureLengthTool]($frontend), [MeasureAreaTool]($frontend), [MeasureVolumeTool]($frontend) for reporting element mass properties.
* [MeasureLocationTool]($frontend), [MeasureDistanceTool]($frontend), [MeasureAreaByPointsTool]($frontend) for reporting point coordinates, point to point distance, and area defined by points.
* [SetupWalkCameraTool]($frontend) to establish the starting position for the walk tool by identifying a point on the floor and look direction.
* [ViewClipByPlaneTool]($frontend), [ViewClipByRangeTool]($frontend), [ViewClipByShapeTool]($frontend), [ViewClipByElementTool]($frontend), [ViewClipClearTool]($frontend) to section a view by a set of clip planes or clip volume.

### [@bentley/imodeljs-backend](https://www.itwinjs.org/reference/imodeljs-backend/)

* [StandaloneDb]($backend) for opening Standalone iModels

## Breaking API changes

### @bentley/imodeljs-frontend

The beta class `InteractiveEditingSession` was renamed to [GraphicalEditingScope]($frontend), resulting in renaming of several related APIs:
  * [GraphicalEditingScope.exit]($frontend) replaces `end`.
  * [GraphicalEditingScope.onEnter]($frontend), [GraphicalEditingScope.onExiting]($frontend), and [GraphicalEditingScope.onExited]($frontend) replace `onBegin`, `onEnding`, and `onEnded` respectively.
  * [BriefcaseConnection.editingScope]($frontend) and [BriefcaseConnection.enterEditingScope]($frontend) replace `editingSession` and `beginEditingSession`.
  * [BriefcaseConnection.supportsGraphicalEditing]($frontend) replaces `supportsInteractiveEditing`.

### @bentley/ui-core

The beta class `SettingsProvider` was renamed to `SettingsTabsProvider`.

### @bentley/ui-framework

The beta class `QuantityFormatSettingsPanel` was renamed to `QuantityFormatSettingsPage`.

### @bentley/imodeljs-quantity

#### UnitProps property name change

The interface [UnitProps]($quantity) property `unitFamily` has been renamed to `phenomenon` to be consistent with naming in `ecschema-metadata` package.

### @bentley/presentation-components

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
