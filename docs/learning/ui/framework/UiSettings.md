# UI Settings

'UI Settings' refers to settings that define the state of different parts of the UI. Settings like if the UI is displayed in "dark" or "light" theme, size and location of column sizes or panel sizes.

## Settings Storage

Settings that are set up to be stored between "session" need to be stored and retrieved from some storage location. There are two provided storage locations that will serve that purpose. [LocalSettingsStorage]($ui-core) will use browser localStorage. [UserSettingsStorage]($ui-framework) will use the Product Settings Service available through IModelApp.settings. Please note that UserSettingsStorage requires the user to be logged-in to have access to this storage.

If an application wants to store settings only for the current session [SessionSettingsStorage]($ui-core) is available.

An application can choose to create and register their own class that implements the [UiSettingsStorage](ui-core) interface, if a custom storage location is desired for UI Settings.

### Defining which storage to use

Typically in the index.tsx file of an IModelApp that uses `App UI` user interface the code will set the storage location once the user has signed in.

```ts
  public static getUiSettingsStorage(): UiSettingsStorage {
    const authorized = !!IModelApp.authorizationClient && IModelApp.authorizationClient.isAuthorized;
    if (!authorized) {
      return MyIModelApp._localUiSettingsStorage; // instance of LocalSettingsStorage
    }
    return MyIModelApp._UserUiSettingsStorage; // instance of UserSettingsStorage
  }
```

The component [UiSettingsProvider]($ui-framework) can be added into the component tree to provide the storage object via React context. See hook [useUiSettingsStorageContext]($ui-framework). Below is an example of how to wrap the [ConfigurableUiContent]($ui-framework) element so that the context is available to all App UI components.

```tsx
  <UiSettingsProvider settingsStorage={uiSettingsStorage}>
    <ConfigurableUiContent
      appBackstage={<AppBackstageComposer />}
    />
  </UiSettingsProvider>
```

## UserSettingsProvider

The [UserSettingsProvider]($ui-framework) interface can be implemented by classes that want to restore their saved settings when the method [UiFramework.setUiSettingsStorage]($ui-framework) is called to set the UiSettingsStorage. A `UserSettingsProvider` class must be registered by calling [UiFramework.registerUserSettingsProvider] and supplying the implementing class instance. The `UserSettingsProvider` interface only requires that the provider define a unique `providerId` that is used to ensure the provider is only registered once. It must also implement the method `loadUserSettings(storage: UiSettingsStorage)` to asynchronously load its settings from [UiSettingsStorage](ui-core).

### AppUiSettings

The [AppUiSettings]($ui-framework) class, which implements the UserSettingsProvider interface, can be instantiated by the IModelApp and registered as an UserSettingsProvider. This is left up to the application so each one can provide default values for the settings maintained by the `AppUiSettings` class. Below is an excerpt from application startup code that shows the registration of `AppUiSettings`.

```ts
  public static async initialize() {
    await UiFramework.initialize(undefined);

    // initialize Presentation
    await Presentation.initialize({
      activeLocale: IModelApp.i18n.languageList()[0],
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

    // go ahead and initialize settings before login or in case login is by-passed
    await UiFramework.setUiSettingsStorage(SampleAppIModelApp.getUiSettingsStorage());
  }
```

## Settings Components

### Quantity Formatting Settings

  The [QuantityFormatSettingsPage]($ui-framework) component provides the UI to set both the [PresentationUnitSystem]($presentation-common) and formatting overrides in the [QuantityFormatter]($frontend). This component can be used in the new [SettingsContainer]($ui-core) UI component. The function `getQuantityFormatsSettingsManagerEntry` will return a [SettingsTabEntry]($ui-core) for use by the [SettingsManager]($ui-core).

### User Interface Settings

  The [UiSettingsPage]($ui-framework) component provides the UI to set general UI settings that effect the look and feel of the App UI user interface. This component can be used in the new [SettingsContainer]($ui-core) UI component. The function `getUiSettingsManagerEntry` will return a [SettingsTabEntry]($ui-core) for use by the [SettingsManager]($ui-core).

### Settings stage

UI and Quantity Settings as well as other settings can be present to the user for editing using the stage [SettingsModalFrontstage]($ui-framework). This stage will display all [SettingsTabEntry]($ui-core) entries that are provided via [SettingsTabsProvider]($ui-core) classes. `SettingsTabsProvider` classes can be registered with the [SettingsManager]($ui-core) by the host application, package, or extension loaded into an IModelApp using the App UI user interface. The steps to add a settings stage include.

#### Adding a backstage item

The [SettingsModalFrontstage.getBackstageActionItem] method can be used to get a [BackstageActionItem]($ui-abstract) that is used to construct the backstage. Below is an example of how to set up a backstage menu component that will display the 'Settings' entry if `SettingsTabEntry` items are provided.

```tsx
export function AppBackstageComposerComponent({ userInfo }: AppBackstageComposerProps) {
  const [backstageItems] = React.useState(() => {
    return [
      BackstageItemUtilities.createStageLauncher(ViewsFrontstage.stageId, 100, 10, IModelApp.i18n.translate("SampleApp:backstage.viewIModel"),
      IModelApp.i18n.translate("SampleApp:backstage.iModelStage"), `svg:${stageIconSvg}`),
      SettingsModalFrontstage.getBackstageActionItem (100, 20),
    ];
  });

  return (
    <BackstageComposer items={backstageItems}
      header={userInfo && <UserProfileBackstageItem userInfo={userInfo} />}
    />
  );
}
```

#### Defining a SettingsTabsProvider

Below is an example [SettingsTabsProvider]($ui-core) class that adds two settings pages, one for Units Formatting and the other for UI Settings. In the `AppUiSettings` example above the call to the static method [AppSettingsTabsProvider.initializeAppSettingProvider] is called to add this provider with the SettingsManager instance held by UiFramework.

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
