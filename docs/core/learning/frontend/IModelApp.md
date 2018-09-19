# Frontend Administration with IModelApp

An instance of [IModelApp]($frontend) provides the services needed by the [frontend](../../learning/App.md#app-frontend) in an [interactive](../WriteAnInteractiveApp.md) iModelJs app. Services include:
* Management of graphical views using [ViewManager](./Views.md)
* [Tools and Drawing Aids](./Tools.md)
* Access to Connect and iModelHub using [IModelClient]($clients)
* [Notifications]($frontend:Notifications)
* [Localization support](./Localization.md)
* App configuration using [Feature Gates](../common/FeatureGates.md)
* User settings using [Settings]($clients:Settings)

Applications may customize the behavior of the IModelApp services by subclassing this class and supplying different implementations of them.

Before any interactive operations may be performed, [IModelApp.startup]($frontend) must be called (typically on a subclass of IModelApp).
