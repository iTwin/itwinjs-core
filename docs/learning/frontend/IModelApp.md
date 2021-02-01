# Frontend Administration with IModelApp

An instance of [IModelApp]($frontend) provides the services needed by the [frontend](../../learning/App.md#app-frontend) in an [interactive](../WriteAnInteractiveApp.md) iModel.js app. Services include:

- Management of graphical views using [ViewManager](./Views.md)
- [Tools](./Tools.md) and [Drawing aids](./DrawingAids.md)
- Access to iModelHub using [IModelClient]($imodelhub-client)
- [Notifications]($frontend:Notifications)
- [Localization support](./Localization.md)
- User settings using [Settings](./Settings.md)

Applications may customize the behavior of the IModelApp services by providing an [IModelAppOptions]($frontend) and supplying different implementations of them.

Before any interactive operations may be performed, [IModelApp.startup]($frontend) must be called (typically within the an App specific startup method).
