# Frontend Administration with IModelApp

An instance of [IModelApp]($frontend) provides the services needed by the [frontend](../../learning/App.md#app-frontend) in an [interactive](../WriteAnInteractiveApp.md) iTwin.js app. Services include:

* Connecting to an [IModelHost]($backend) to access iModels.
* Management of Views using [ViewManager](./Views.md)
* [Tools](./Tools.md) and [Drawing aids](./DrawingAids.md)
* Access to iModelHub using [IModelClient]($imodelhub-client)
* [Notifications]($frontend:Notifications)
* [Localization support](./Localization.md)
* User settings using [Settings](./Settings.md)

## IModelApp Specializations

To support the various use cases and platforms for iTwin.js frontends, there are specialized "apps" that should be used where appropriate.

> For a given frontend, you will pick *one* class from the following list, and call its `startup` method. The type of `IModelApp` should match the type of [IModelHost](../backend/IModelHost.md) running on your backend.

* **[IModelApp]($frontend)**: must always be initialized. For RPC, connects to previously-initialized `IModelHost`(s) through routing.
  * **`WebViewerApp`**: frontend of web viewing apps. May only open iModels readonly, and may not use Ipc. `WebViewerApp.startup` calls [IModelApp.startup]($frontend).
  * **[IpcApp]($frontend)**: for frontends with a dedicated [IpcHost]($backend) backend. [IpcApp.startup]($frontend) calls [IModelApp.startup]($frontend). `IpcApp` is abstract and should not be used directly.
    * **`WebEditApp`**: for the frontend of web editing apps connected to a `WebEditHost` backend. `WebEditApp.startup` calls [IpcApp.startup]($frontend) and must supply the user's credentials.
    * **`ElectronApp`**: for the frontend of desktop apps running on Windows, Mac, or Linux connected to an `ElectronHost` backend. `ElectronApp.startup` calls [IpcApp.startup]($frontend).
    * **`MobileApp`**: for the frontend of mobile apps. `MobileApp.startup` calls [IpcApp.startup]($frontend). `MobileApp` is abstract and should not be used directly.
      * **`IOSApp`**: for the frontend of iOS apps. `IOSApp.startup` calls `MobileApp.startup`.
      * **`AndroidApp`**: for the frontend of Android apps. `AndroidApp.startup` calls `MobileApp.startup`.

Applications may customize the behavior of the IModelApp services by providing [IModelAppOptions]($frontend).
