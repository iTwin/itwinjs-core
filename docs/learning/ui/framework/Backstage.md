# Backstage

The Backstage is a menu used to open frontstages and launch tasks and commands.
It can also open full-screen overlays presenting application settings and data management to the user.
These overlays are an implementation of a modal frontstage. The backstage is opened by clicking or pressing the App button and displays along the left edge of the window.

## Defining the Backstage

To ensure that an extension can supply items for the Backstage menu, it should be created using the [BackstageComposer]($ui-framework) component. The example below shows how to provide [BackstageActionItem]($ui-abstract) and [BackstageStageLauncher]($ui-abstract) item to the BackstageComposer.

```tsx
import stageIconSvg from "@bentley/icons-generic/icons/imodeljs.svg?sprite";
import settingsIconSvg from "@bentley/icons-generic/icons/settings.svg?sprite";

export function AppBackstageComposer() {
  const [backstageItems] = React.useState(() => [
    BackstageItemUtilities.createStageLauncher("app.SampleFrontstage", 100, 10, IModelApp.i18n.translate("app:backstage.sampleFrontstage"), undefined, IconSpecUtilities.createSvgIconSpec(stageIconSvg)),
    SettingsModalFrontstage.getBackstageActionItem (300, 10),
  ]);

  return (
    <BackstageComposer items={backstageItems} />
  );
}
```

Note: the static method `SettingsModalFrontstage.getBackstageActionItem` used above, will create an entry for a `Settings` stage.  This stage will display [SettingsTabEntry]($ui-core) items from [SettingsProvider]($ui-core) classes registered with the [SettingsManager]($ui-core). The `SettingsManager` instance is referenced by property `UiFramework.settingsManager`.

See additional info in [Backstage](../../../learning/ui/abstract/Backstage.md).

## Specifying a Backstage in ConfigurableUiContent

Below is an example of defining the ConfigurableUiContent and specifying the backstage, using the component from the above example.

```tsx
<ConfigurableUiContent appBackstage={<AppBackstageComposer />} />
```
