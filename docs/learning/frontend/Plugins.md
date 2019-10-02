# iModel.js Plugins

A [Plugin]($frontend) is a separately webpacked JavaScript module that is loaded on demand into a browser (or Electron) running the the frontend iModel.js environment. It is compiled and webpacked using the [buildIModelJsModule](./BuildingIModelJsModules.md) script. The build process creates a tar file that includes a manifest, the webpacked plugin, and the associated resources.

A [Plugin]($frontend) is written in Typescript. It has access to all exported classes in the iModel.js host environment. In all iModel.js hosts, that will include the exports of bentleyjs-core, geometry-core, imodeljs-i18n, imodeljs-clients, imodeljs-common, imodeljs-quantity, and imodeljs-frontend. In hosts that use the iModel.js user interface classes, it will also include the exports of ui-core, ui-components, ui-ninezone, and ui-framework. In hosts that are designed to format and display EC data, the presentation-common, presentation-components, and presentation-frontend modules will be available as well. An example host is Design Review, which includes all of the modules above.

## Loading Plugins

A [Plugin]($frontend) can be loaded by calling the `loadPlugin` static method of the [PluginAdmin]($frontend) class. An [ImmediateTool](./Tools.md#immediate-tools) is provided that allows a user to initiate [Plugin]($frontend) loading using the "Plugin \<pluginName\> [argument list]" keyin.

When the [PluginAdmin]($frontend) loadPlugin method is called, it initiates loading of the designated [Plugin]($frontend). The [Plugin]($frontend) is loaded as a typical JavaScript script, so any code that is outside the definition of a function or class is immediately executed. By convention, a [Plugin]($frontend) defines a "main" function and executes that main function as the last line in the script. Generally, the only responsibility of the main function is to instantiate the subclass of [Plugin]($frontend) defined therein and register it with the [PluginAdmin]($frontend). Here is an example:

```ts
declare var PLUGIN_NAME: string;

// define and run the entry point
function main() {
  PluginAdmin.register(new MeasurePointsPlugin(PLUGIN_NAME));
}

main();
```

In the code above, note the declaration of PLUGIN_NAME. This variable is converted to an actual string when your [Plugin]($frontend) is webpack'ed as described below. PLUGIN_NAME is used by the [PluginAdmin]($frontend) to keep track of currently loaded Plugins.

## Building Plugins

The code for the [Plugin]($frontend) is typically transpiled to JavaScript and then converted to a loadable module with [webpack](https://webpack.js.org). It is then packaged into a tar file, along with a manifest and all the resources that it needs. The manifest records the required versions of iModelJs system modules as well as other information needed by the Plugin loader. Those steps (and others that might be required), are sequenced by the buildIModelJsModule script. See [Building iModel.js Modules](./BuildingIModelJsModules.md) for a full description of building a [Plugin]($frontend).

The versions of iModel.js packages that are required by the [Plugin](%frontend) are extracted from the "dependencies" key in the package.json file that is in the root directory of the package that contains the Plugin source. Each iModel.js module from which classes or functions are imported should appear in that dependencies key, along with the version number as is required by [npm](https://docs.npmjs.org).

## Plugin startup

Plugins are loaded by the PluginAdmin class. The "main" function in the [Plugin]($frontend) code should instantiate and register the Plugin as illustrated above. The PluginAdmin.register method checks whether the iModel.js runtime environment is compatible with the [Plugin]($frontend)'s requirements. If not, an error is displayed to the user (and a list of the errors encountered is returned from the call to PluginAdmin.register) and the Plugin can proceed no further. If the validation succeeds, the `onLoad` method of your [Plugin]($frontend) subclass is called. The argument to the onLoad and onExecute method is an array of strings. The first member of the array is the plugin name. A typical use of the `onLoad` method is to register any tools that the Plugin provides. Here is a simple subclass of [Plugin]($frontend):

```ts
class MeasurePointsPlugin extends Plugin {
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

The Plugin subclass' onExecute method is called immediately after the call to `onLoad`. The difference between `onLoad` and `onExecute` is that `onExecute` is called each time [PluginAdmin]($frontend).loadPlugin is called for the same plugin. Therefore, anything that need be done only once (such as registering a Tool), should go into the `onLoad` method and everything that should be done each time the Plugin is loaded (in this case, starting the registered Tool), should be done in the `onExecute` method.

## Loading Plugins on Application Startup

When an application opens the first view of an iModel, the Plugin Administrator examines user settings, application settings, and the application's Config.App to assemble a list of plugins that should be loaded automatically. The plugin lists from user and application settings are retrieved by the [SettingsAdmin]($client). The [PluginAdmin]($frontend) class includes two methods, ```addSavedPlugins``` and ```removeSavedPlugins``` to manipulate that list for either the user or the application settings. The methods should be called with the ```settingName``` argument of "StartViewPlugins" to manipulate the startup plugins. Any user can save plugin specifications for his or her personal use, but saving plugin specifications to be processed for all users of the application requires administrative privileges.

In addition to plugin lists stored in ```SettingsAdmin``` settings, the application's configuration can specify such a list. The ```PluginAdmin``` calls ```Config.App.get("SavedPlugins.StartViewPlugins")```, and if it returns a string, it is interpreted as a list of plugins separated by semicolons. To pass arguments  to the plugins as they are loaded, separate the arguments from the plugin name and each other using the pipe "|" character. For example, the following entry in the applications config.json file starts the "safety" plugin with arguments "zone1" and "zone2", and the "visualize" plugin with no arguments:

```json
config.json
{
    "imjs_oidc_redirecturi": "/signin-oidc",
    "imjs_oidc_responsetype": "id_token token",
    "imjs_oidc_scope": "openid email profile organization feature_tracking imodelhub context-registry-service imodeljs-router reality-data:read product-settings-service",
    ...
    "SavedPlugins": {
      "StartViewPlugins": "safety|zone1|zone2;visualize"
    }
}
```

PluginAdmin attempts to load all plugins in the union of the three plugin lists. Successful and failed loads are reported through the [NotificationManager]($frontend).
