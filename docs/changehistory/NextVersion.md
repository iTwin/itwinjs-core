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

### Add Settings Page to set Quantity Formatting Overrides

The [QuantityFormatSettingsPanel]($ui-framework) component has been added to the @bentley/ui-framework package to provide the UI to set both the [PresentationUnitSystem]($presentation-common) and formatting overrides in the [QuantityFormatter]($frontend). This panel can be used in the new [SettingsContainer]($ui-core) UI component. The function `getQuantityFormatsSettingsManagerEntry` will return a [SettingsTabEntry]($ui-core) for use by the [SettingsManager]($ui-core). Below is an example of registering the `QuantityFormatSettingsPanel` with the `SettingsManager`.

```ts
// Sample settings provider that dynamically adds settings into the setting stage
export class AppSettingsProvider implements SettingsProvider {
  public readonly id = "AppSettingsProvider";

  public getSettingEntries(_stageId: string, _stageUsage: string): ReadonlyArray<SettingsTabEntry> | undefined {
    return [
      getQuantityFormatsSettingsManagerEntry(10, {availableUnitSystems:new Set(["metric","imperial","usSurvey"])}),
    ];
  }

  public static initializeAppSettingProvider() {
    UiFramework.settingsManager.addSettingsProvider(new AppSettingsProvider());
  }
}

```

The `QuantityFormatSettingsPanel` is marked as alpha in this release and is subject to minor modifications in future releases.

## @bentley/imodeljs-quantity package

The alpha classes, interfaces, and definitions in the package `@bentley/imodeljs-quantity` have been updated to beta.

## Incremental Precompilation of Shaders Enabled by Default

To help prevent delays when a user interacts with a [Viewport]($frontend), the WebGL render system now by default precompiles shader programs used by the [RenderSystem]($frontend) before any Viewport is opened.

Shader precompilation will cease once all shader programs have been compiled, or when a [Viewport]($frontend) is opened (registered with the [ViewManager]($frontend)).  As such, applications which do not open a [Viewport]($frontend) immediately upon startup stand to benefit - for example, if the user is first expected to select an iModel and/or a view through the user interface.

To disable this functionality, set the `doIdleWork` property of the `RenderSystem.Options` object passed to `IModelApp.startup` to false.

## Breaking Api Changes

### @bentley/imodeljs-quantity package

#### UnitProps property name change

The interface [UnitProps]($quantity) property `unitFamily` has been renamed to `phenomenon` to be consistent with naming in `ecschema-metadata` package.
