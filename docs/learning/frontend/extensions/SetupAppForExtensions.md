# Setup App to load Extensions

By default, every [IModelApp]($frontend) has the [ExtensionAdmin]($frontend) configured to use the Bentley Extension Service. However, additional endpoints can be configured by adding an [ExtensionLoader]($frontend) to the `ExtensionAdmin` with [ExtensionAdmin.addExtensionLoader]($frontend) or providing a different instance of the `ExtensionAdmin` to [IModelApp.startup]($frontend).

There are two `ExtensionLoaders` provided, one, [ExtensionServiceExtensionLoader]($frontend), for connecting to the Bentley Extension Service, and the second, [ExternalServerExtensionLoader]($frontend), for using a different URL scheme for pulling the Extensions. The second one is most commonly used for deploying an Extension locally to debug.

## Loading Extensions

An [Extension]($frontend) is loaded into an app by calling the [ExtensionAdmin.loadExtension]($frontend) static method, which uses the current [IModelApp.extensionAdmin]($frontend) session to load the provided extension.

The `Extension` is loaded using the [HTML script tag](https://developer.mozilla.org/docs/Web/HTML/Element/script), making any code within the javascript module immediately executed.

By convention, an `Extension` creates an instance of itself and registers the new instance with the host app, using `IModelApp.extensionAdmin.register`, in the top-level scope. This is the first step required in properly loading and allows `IModelApp` to know the request to `loadExtension` has succeeded and the Extension is now ready for the `onLoad` method to be executed.

## Other ways to load an Extension

An [ImmediateTool](../Tools.md#immediate-tools) is, by default, provided in every IModelApp which supports a user to initiate the [Extension]($frontend) loading process using the `Extension \<ExtensionName\> [argument list]` keyin.
