# UI Settings

'UI Settings' refers to settings that define the state of different parts of the UI. Settings like if the UI is displayed in "dark" or "light" theme, size and location of column sizes or panel sizes.

## Settings Storage

Settings that are set up to be stored between "session" need to be stored and retrieved from some storage location. There are two provided storage locations that will serve that purpose. [LocalSettingsStorage]($ui-core) will use browser localStorage. [UserSettingsStorage]($ui-framework) will use the Product Settings Service available through IModelApp.settings. Please note that UserSettingsStorage requires the user to be logged-in to have access to this storage.

If an application wants to store settings only for the current session [SessionSettingsStorage]($ui-core) is available.

### Defining which storage to use

Typically in the index.tsx file of an IModelApp that uses `App UI` user interface the code will set the storage location once the user has signed in.

```ts
  public static getUiSettingsStorage(): UiSettings {
    const authorized = !!IModelApp.authorizationClient && IModelApp.authorizationClient.isAuthorized;
    if (!authorized) {
      return MyIModelApp._localUiSettings; // instance of LocalSettingsStorage
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
