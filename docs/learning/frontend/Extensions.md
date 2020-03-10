# iModel.js Extensions

A [Extension]($frontend) is a separate JavaScript module that is loaded on demand into an iModel.js frontend.  It is compiled and webpacked using the [buildIModelJsModule](./BuildingIModelJsModules.md) script. The build process creates a tar file that includes a manifest, the webpacked Extension, and the associated resources.

A Extension has access to all exported classes in the iModel.js host environment. In all iModel.js hosts, that will include the exports of bentleyjs-core, geometry-core, imodeljs-i18n, imodeljs-clients, imodeljs-common, imodeljs-quantity, and imodeljs-frontend. In hosts that use the iModel.js user interface classes, it will also include the exports of ui-core, ui-components, ui-ninezone, and ui-framework. In hosts that are designed to format and display EC data, the presentation-common, presentation-components, and presentation-frontend modules will be available as well. An example host is Design Review, which includes all of the modules above.

## Loading Extensions

A [Extension]($frontend) can be loaded by calling the `loadExtension` static method of the [ExtensionAdmin]($frontend) class. An [ImmediateTool](./Tools.md#immediate-tools) is provided that allows a user to initiate [Extension]($frontend) loading using the "Extension \<ExtensionName\> [argument list]" keyin.

When the [ExtensionAdmin]($frontend) loadExtension method is called, it initiates loading of the designated [Extension]($frontend). The [Extension]($frontend) is loaded as a typical JavaScript script, so any code that is outside the definition of a function or class is immediately executed. By convention, a [Extension]($frontend) defines a "main" function and executes that main function as the last line in the script. Generally, the only responsibility of the main function is to instantiate the subclass of [Extension]($frontend) defined therein and register it with the [ExtensionAdmin]($frontend). Here is an example:

```ts
declare var Extension_NAME: string;

// define and run the entry point
function main() {
  ExtensionAdmin.register(new MeasurePointsExtension(Extension_NAME));
}

main();
```

In the code above, note the declaration of Extension_NAME. This variable is converted to an actual string when your [Extension]($frontend) is webpack'ed as described below. Extension_NAME is used by the [ExtensionAdmin]($frontend) to keep track of currently loaded Extensions.

## Building Extensions

The code for the [Extension]($frontend) is typically transpiled to JavaScript and then converted to a loadable module with [webpack](https://webpack.js.org). It is then packaged into a tar file, along with a manifest and all the resources that it needs. The manifest records the required versions of iModelJs system modules as well as other information needed by the Extension loader. Those steps (and others that might be required), are sequenced by the buildIModelJsModule script. See [Building iModel.js Modules](./BuildingIModelJsModules.md) for a full description of building a [Extension]($frontend).

The versions of iModel.js packages that are required by the [Extension]($frontend) are extracted from the "dependencies" key in the package.json file that is in the root directory of the package that contains the Extension source. Each iModel.js module from which classes or functions are imported should appear in that dependencies key, along with the version number as is required by [npm](https://docs.npmjs.org).

## Extension startup

Extensions are loaded by the ExtensionAdmin class. The "main" function in the [Extension]($frontend) code should instantiate and register the Extension as illustrated above. The ExtensionAdmin.register method checks whether the iModel.js runtime environment is compatible with the [Extension]($frontend)'s requirements. If not, an error is displayed to the user (and a list of the errors encountered is returned from the call to ExtensionAdmin.register) and the Extension can proceed no further. If the validation succeeds, the `onLoad` method of your [Extension]($frontend) subclass is called. The argument to the onLoad and onExecute method is an array of strings. The first member of the array is the Extension name. A typical use of the `onLoad` method is to register any tools that the Extension provides. Here is a simple subclass of [Extension]($frontend):

```ts
class MeasurePointsExtension extends Extension {
  private _measureNamespace: I18NNamespace | undefined;

  public constructor(name: string) {
    super(name);
    this._measureNamespace = undefined;
  }

  public onLoad(_args: string[]): void {
    // don't register the namespace and the tool until the onLoad method. That's called after we know the versions of the modules required are good.
    this._measureNamespace = IModelApp.i18n.registerNamespace("MeasureTool");
    this._measureNamespace.readFinished.then(() => { MeasurePointsTool.register(this._measureNamespace); })
      .catch((err) => { console.log(err); });
  }

  public onExecute(_args: string[]): void {
    // don't start the tool until the localized strings are available.
    this._measureNamespace!.readFinished.then(() => {
      // start the tool.
      IModelApp.tools.run("Measure.Points");
    });
  }
}
```

The Extension subclass' onExecute method is called immediately after the call to `onLoad`. The difference between `onLoad` and `onExecute` is that `onExecute` is called each time [ExtensionAdmin]($frontend).loadExtension is called for the same Extension. Therefore, anything that need be done only once (such as registering a Tool), should go into the `onLoad` method and everything that should be done each time the Extension is loaded (in this case, starting the registered Tool), should be done in the `onExecute` method.

## Loading Extensions on Application Startup

When an application opens the first view of an iModel, the Extension Administrator examines user settings, application settings, and the application's Config.App to assemble a list of Extensions that should be loaded automatically. The Extension lists from user and application settings are retrieved by the [SettingsAdmin]($client). The [ExtensionAdmin]($frontend) class includes two methods, ```addSavedExtensions``` and ```removeSavedExtensions``` to manipulate that list for either the user or the application settings. The methods should be called with the ```settingName``` argument of "StartViewExtensions" to manipulate the startup Extensions. Any user can save Extension specifications for his or her personal use, but saving Extension specifications to be processed for all users of the application requires administrative privileges.

In addition to Extension lists stored in ```SettingsAdmin``` settings, the application's configuration can specify such a list. The ```ExtensionAdmin``` calls ```Config.App.get("SavedExtensions.StartViewExtensions")```, and if it returns a string, it is interpreted as a list of Extensions separated by semicolons. To pass arguments  to the Extensions as they are loaded, separate the arguments from the Extension name and each other using the pipe "|" character. For example, the following entry in the applications config.json file starts the "safety" Extension with arguments "zone1" and "zone2", and the "visualize" Extension with no arguments:

```json
config.json
{
    "imjs_oidc_redirecturi": "/signin-oidc",
    "imjs_oidc_responsetype": "id_token token",
    "imjs_oidc_scope": "openid email profile organization feature_tracking imodelhub context-registry-service imodeljs-router reality-data:read product-settings-service",
    ...
    "SavedExtensions": {
      "StartViewExtensions": "safety|zone1|zone2;visualize"
    }
}
```

ExtensionAdmin attempts to load all Extensions in the union of the three Extension lists. Successful and failed loads are reported through the [NotificationManager]($frontend).
