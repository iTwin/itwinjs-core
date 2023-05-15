# Backstage

The Backstage is a menu used to open frontstages and launch tasks and commands.
It can also open full-screen overlays presenting application settings and data management to the user.
These overlays are an implementation of a modal frontstage. The backstage is opened by clicking or pressing the App button and displays along the left edge of the window.

## Defining the Backstage

To ensure that an extension can supply items for the Backstage menu, it should be created using the [BackstageComposer]($appui-react) component. The example below shows how to provide [BackstageActionItem]($appui-react) and [BackstageStageLauncher]($appui-react) item to the BackstageComposer.

```tsx
import stageIconSvg from "@bentley/icons-generic/icons/imodeljs.svg";
import settingsIconSvg from "@bentley/icons-generic/icons/settings.svg";

export function AppBackstageComposer() {
  const [backstageItems] = React.useState(() => [
    BackstageItemUtilities.createStageLauncher("app.SampleFrontstage", 100, 10, IModelApp.i18n.translate("app:backstage.sampleFrontstage"), undefined, IconSpecUtilities.createWebComponentIconSpec(stageIconSvg)),
    SettingsModalFrontstage.getBackstageActionItem (300, 10),
  ]);

  return (
    <BackstageComposer items={backstageItems} />
  );
}
```

Note: the static method `SettingsModalFrontstage.getBackstageActionItem` used above, will create an entry for a `Settings` stage.  This stage will display [SettingsTabEntry]($core-react) items from [SettingsTabsProvider]($core-react) classes registered with the [SettingsManager]($core-react). The `SettingsManager` instance is referenced by property `UiFramework.settingsManager`.

## Specifying a Backstage in ConfigurableUiContent

Below is an example of defining the ConfigurableUiContent and specifying the backstage, using the component from the above example.

```tsx
<ConfigurableUiContent appBackstage={<AppBackstageComposer />} />
```

## Backstage Item Utilities

[BackstageItemUtilities]($appui-react) is a utility class to create abstract Backstage item definitions that define entries in the Backstage menu.

The following shows an example of defining an item to create an item that opens a primary stage.

```ts
BackstageItemUtilities.createStageLauncher("IModelIndex", 200, 20, IModelApp.i18n.translate("SampleApp:backstage.imodelindex"), undefined, "icon-placeholder"),
```

The following shows an example of defining an item that executes an action.

```ts
BackstageItemUtilities.createActionItem("SampleApp.settings", 300, 10, () => FrontstageManager.openModalFrontstage(new SettingsModalFrontstage()), IModelApp.i18n.translate("SampleApp:backstage.testFrontstage6"), undefined, "icon-placeholder"),
```

In both examples, the first parameter is a key for the backstage item. This key must be unique across all other backstage items. The next two parameters define the group priority and the item priority within the group.  These values are use to determine the order of the item in the menu. This method allows other packages and extensions to insert items at specific positions within the menu.  It is recommended that the host application increment group priority by 100 and item priority by 10 to provide sufficient gaps for additional groups and items. The ordering is done from lowest to highest priority values.

## API Reference

[Backstage]($appui-react:Backstage)
