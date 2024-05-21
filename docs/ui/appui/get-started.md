---
tableRowAnchors: true
jotform: true
---

# Get Started

There are two ways to start using the AppUI framework. You can either use the prebuilt `Viewer` component or configure the AppUI manually depending on your needs.

## Viewer component

The Viewer component is a wrapper around iTwin.js and AppUI that does the required initializations, provides a default configuration and a set of props to control AppUI for a quick start.

The Viewer component is available in the [@itwin/web-viewer-react](https://www.npmjs.com/package/@itwin/web-viewer-react) or [@itwin/desktop-viewer-react](https://www.npmjs.com/package/@itwin/desktop-viewer-react) packages.

Use the viewer component by rendering it in your React App. Below is an example of the web viewer component in its simplest form and will display a 3D view of the iModel.

```tsx
<Viewer authClient={authClient} iTwinId={iTwinId} iModelId={iModelId} />
```

You can get more information on the available props and how to use them in the package's documentation linked above.

If starting from scratch, you can follow the web or desktop starter applications [tutorials](../../learning/tutorials/index.md#starter-applications).

## Manual configuration

To get full control over AppUI initialization, you can configure it manually. This is useful if you need specific behavior during the initialization, are not satisfied with the Viewer component behavior or already have set up your IModelApp web, desktop or mobile application.

1. Initialize `IModelApp`.

   AppUI relies on the iTwin.js [IModelApp]($core-frontend) singleton. You can initialize it by calling `IModelApp.startup()` and provide it with the desired configuration.

   Some of AppUI features are provided through the following `IModelApp` startup options.

   | Option          | Class                                  |
   | --------------- | -------------------------------------- |
   | `notifications` | [AppNotificationManager]($appui-react) |
   | `uiAdmin`       | [FrameworkUiAdmin]($appui-react)       |
   | `accuDraw`      | [FrameworkAccuDraw]($appui-react)      |

   <!-- Here we have a problem, we don't have the type of learning document that we are currently writing that matches the level of information we give here for IModelApp setup part...

   You can find more information on setting up IModelApp in the learning section .?.?.?
    -->

2. Initialize `UiFramework`.

   `UiFramework` is the core state and main entry point of AppUI API. It is a singleton that needs to be initialized before using any of the AppUI components. If you already use a redux store for your application, you can provide it to the `UiFramework` singleton at initialization, along with a key where the state should be kept in your app store. Otherwise, `UiFramework` will create its own store by passing it `undefined`. This store can then be accessed by the `UiFramework.store` property.

   ```tsx
   UiFramework.initialize(store, "appUIState");
   ```

   or

   ```tsx
   UiFramework.initialize(undefined);
   ```

3. Render `ConfigurableUiContent`.

   `ConfigurableUiContent` is the main component of AppUI. It is responsible for rendering the UI and managing the UI state. It needs to be rendered inside a react-redux `Provider` and AppUI `ThemeManager` and `UiStateStorageHandler` components as well.

   ```tsx
   <Provider store={UiFramework.store}>
     <ThemeManager>
       <UiStateStorageHandler>
         <ConfigurableUiContent />
       </UiStateStorageHandler>
     </ThemeManager>
   </Provider>
   ```

With these initialization steps, AppUI is ready to display frontstages.

## Next steps

Wether you use the Viewer component or configure AppUI manually, you can now create the content your application will display by following the [Define Content](./define-content.md) section.
