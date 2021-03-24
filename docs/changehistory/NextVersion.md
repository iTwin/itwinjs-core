---
publish: false
---
# NextVersion

## New Settings UI Features

### Add Settings Tabs and Pages to UI

#### Quantity Formatting Settings

The [QuantityFormatSettingsPage]($ui-framework) component has been added to provide the UI to set both the [PresentationUnitSystem]($presentation-common) and formatting overrides in the [QuantityFormatter]($frontend). This component can be used in the new [SettingsContainer]($ui-core) UI component. The function `getQuantityFormatsSettingsManagerEntry` will return a [SettingsTabEntry]($ui-core) for use by the [SettingsManager]($ui-core).

#### User Interface Settings

The [UiSettingsPage]($ui-framework) component has been to provide the UI to set general UI settings that effect the look and feel of the App UI user interface. This component can be used in the new [SettingsContainer]($ui-core) UI component. The function `getUiSettingsManagerEntry` will return a [SettingsTabEntry]($ui-core) for use by the [SettingsManager]($ui-core).

#### Registering Settings

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

## Breaking Api Changes

### @bentley/ui-core package

The beta class `SettingsProvider` was renamed to `SettingsTabsProvider`.

### @bentley/ui-framework package

The beta class `QuantityFormatSettingsPanel` was renamed to `QuantityFormatSettingsPage`.

### @bentley/imodeljs-quantity package

#### UnitProps property name change

The interface [UnitProps]($quantity) property `unitFamily` has been renamed to `phenomenon` to be consistent with naming in `ecschema-metadata` package.
