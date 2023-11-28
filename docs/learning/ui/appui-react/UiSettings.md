# Application UI Settings

'Application UI Settings' refers to settings that define the state of different parts of the UI, e.g., "dark" or "light" theme, size and location of column sizes, or panel sizes.

### AppUiSettings

The [AppUiSettings]($appui-react) class, which implements the UserSettingsProvider interface, can be instantiated by the IModelApp and registered as an UserSettingsProvider. This is left up to the application so each one can provide default values for the settings maintained by the `AppUiSettings` class. Below is an excerpt from application startup code that shows the registration of `AppUiSettings`.

```ts
  public static async initialize() {
    await UiFramework.initialize(undefined);

    // initialize Presentation
    await Presentation.initialize({
      activeLocale: IModelApp.i18n.getLanguageList()[0],
    });
    Presentation.selection.scopes.activeScope = "top-assembly";

     // other initialization calls not shown in this example excerpt

    // app specific call to register setting pages to display
    AppSettingsTabsProvider.initializeAppSettingProvider();

    // Create and register the AppUiSettings instance to provide default for ui settings in Redux store
    const lastTheme = (window.localStorage&&window.localStorage.getItem("uifw:defaultTheme"))??SYSTEM_PREFERRED_COLOR_THEME;
    const defaults = {
      colorTheme: lastTheme ?? SYSTEM_PREFERRED_COLOR_THEME,
      dragInteraction: false,
      frameworkVersion: "2",
      widgetOpacity: 0.8,
    };

    // initialize any settings providers that may need to have defaults set by iModelApp
    UiFramework.registerUserSettingsProvider(new AppUiSettings(defaults));

  }
```

## Settings Components

### Quantity Formatting Settings

  The [QuantityFormatSettingsPage]($appui-react) component provides the UI to set both the [PresentationManager.activeUnitSystem]($presentation-frontend) and formatting overrides in the [QuantityFormatter]($frontend). This component can be used in the new [SettingsContainer]($core-react) UI component. The function `getQuantityFormatsSettingsManagerEntry` will return a [SettingsTabEntry]($core-react) for use by the [SettingsManager]($core-react).

### User Interface Settings

  The [UiSettingsPage]($appui-react) component provides the UI to set general UI settings that effect the look and feel of the App UI user interface. This component can be used in the new [SettingsContainer]($core-react) UI component. The function `getUiSettingsManagerEntry` will return a [SettingsTabEntry]($core-react) for use by the [SettingsManager]($core-react).

### Settings stage

UI and Quantity Settings as well as other settings can be present to the user for editing using the stage [SettingsModalFrontstage]($appui-react). This stage will display all [SettingsTabEntry]($core-react) entries that are provided via [SettingsTabsProvider]($core-react) classes. `SettingsTabsProvider` classes can be registered with the [SettingsManager]($core-react) by the host application, package, or extension loaded into an IModelApp using the App UI user interface. The steps to add a settings stage include.

#### Adding a backstage item

The [SettingsModalFrontstage.getBackstageActionItem] method can be used to get a [BackstageActionItem]($appui-react) to construct the backstage. Below is an example of how to set up a backstage menu component to display the 'Settings' entry if `SettingsTabEntry` items are provided.

```tsx
export function AppBackstageComposerComponent() {
  const [backstageItems] = React.useState(() => {
    return [
      BackstageItemUtilities.createStageLauncher(ViewsFrontstage.stageId, 100, 10, IModelApp.i18n.translate("SampleApp:backstage.viewIModel"),
      IModelApp.i18n.translate("SampleApp:backstage.iModelStage"), `svg:${stageIconSvg}`),
      SettingsModalFrontstage.getBackstageActionItem (100, 20),
    ];
  });

  return (
    <BackstageComposer items={backstageItems} />
  );
}
```

#### Defining a SettingsTabsProvider

Below is an example [SettingsTabsProvider]($core-react) class that adds two settings pages, one for Units Formatting and the other for UI Settings. In the `AppUiSettings` example above the call to the static method [AppSettingsTabsProvider.initializeAppSettingProvider] is called to add this provider with the SettingsManager instance held by UiFramework.

```tsx
export class AppSettingsTabsProvider implements SettingsTabsProvider {
  public readonly id = "AppSettingsTabsProvider";

  public getSettingEntries(_stageId: string, _stageUsage: string): ReadonlyArray<SettingsTabEntry> | undefined {
    return [
      getQuantityFormatsSettingsManagerEntry(10, {availableUnitSystems:new Set(["metric","imperial","usSurvey"])}),
      getUiSettingsManagerEntry(20),
    ];
  }

  public static initializeAppSettingProvider() {
    UiFramework.settingsManager.addSettingsProvider(new AppSettingsTabsProvider());
  }
```
