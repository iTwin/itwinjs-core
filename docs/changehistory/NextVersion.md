---
publish: false
---
# NextVersion

## New Settings UI Features

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

## Breaking Api Changes

### @bentley/imodeljs-quantity package

#### UnitProps property name change

The interface [UnitProps]($quantity) property `unitFamily` has been renamed to `phenomenon` to be consistent with naming in `ecschema-metadata` package.
