# Creating an Extension

All iTwin.js Extensions must sub-class [Extension]($frontend) and implement the two required methods,`onLoad` and `onExecute`.

An Extension is not required to rely on any specific UI framework (React, Angular, Vue.js, etc), much like iTwin.js itself. Instead, to support adding UI into an iTwin.js application, agnostic of the UI framework, the [ui&#8209;abstract](../../ui/abstract/index.md) package can be used to support several ways of extend an app without using knowing the UI technology used within the hosting app.

However, if the host app's UI framework is known then an Extension can freely use those technologies as well.

> Warning: While mixing UI frameworks may be technically possible, it is not recommended.

## Getting Started

The 3 most important parts of any Extension are,

1. The [initialization](#initializing-an-extension) of the Extension with the HostApp
1. The `onLoad` and `onExecute` implementation, explained [below](#extension-startup)
1. [Building the Extension](#building-an-extension)

### Initializing an Extension

The first step in writing an Extension is to notify the host app the Extension is available to be used and executed.

The Extension is in charge of registering itself with the host app using the [ExtensionAdmin.register]($frontend) method from the static [IModelApp.extensionAdmin]($frontend) as early in the execution process as possible. Often performed at the top-level of the JavaScript module to ensure it is the one of the first things executed.

Once the `ExtensionAdmin` knows that the Extension exists, it can then perform the main [Extension startup](#extension-startup) process.

### Extension startup

Immediately after registering, the `onLoad` method is called. The arguments provided to the `onLoad` and `onExecute` methods is an array of strings. The first member of the array is the Extension name.

A typical use of the `onLoad` method is to register any tools that the Extension provides.

The Extension's `onExecute` method is called immediately after the call to `onLoad`. The difference between `onLoad` and `onExecute` is that `onExecute` is called each time [ExtensionAdmin.loadExtension]($frontend) method is called for the same Extension. Therefore, anything that needs to be done only once (such as registering a Tool), should go into the `onLoad` method and everything that should be done each time the Extension is loaded (in this case, starting the registered Tool), should be done in the `onExecute` method.

### Building an Extension

Extensions should be built with the [@bentley/extension-webpack-tools](https://www.npmjs.com/package/@bentley/extension-webpack-tools) package which handles properly bundling the javascript and assets into the format expected by the host application.
