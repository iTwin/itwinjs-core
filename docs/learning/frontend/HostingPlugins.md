# Hosting iModel.js Plugins on an External Web Server

[Plugins](./Plugins.md) can be hosted on the same web server that hosts the iModel.js application, but quite often a user wants to run a plugin in an application hosted by a web server that he or she does not control. In that case, the plugin can be hosted on a different web server (one that the user does control, so the appropriate files can be placed on it). A limitation is that the web server must allow [CORS](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing) (Cross Origin Resource Sharing) from the web origin where the iModel.js application is hosted. For example, if a Plugin is to be run in Bentley's Design Review, the web server hosting the Plugin must allow CORS requests from bentley.com. See [CORS considerations](#cors-considerations) for more information.

A Plugin that is hosted on an external web server may require a few source code modifications. See [Source Code Modifications](#source-code-modifications) for details.

## Hosting the Plugin

As mentioned in [BuildingIModelJsModules](./BuildingIModelJsModules.md), when a Plugin is built, a directory structure is created that contains the various files associated with the Plugin, and a separate [tar file](https://en.wikipedia.org/wiki/Tar_%28computing%29) that packages all plugin resources into one file is also created. Either the build directory or the tar file can be used to install the files on the hosting web server. Below, we discuss a few scenarios that you may encounter.

### 1 - Developing the Plugin

#### 1a - Building the Target Application Locally

If you are building the application that is hosting the Plugin, then the easiest way to test a Plugin that is to be hosted on an external web server is to run two instances of an Express web server. An example server is included in the iModelJs source code, and is available from npm as @bentley/imodeljs-webserver. In a typical test setup, you might deliver the application resources from a webserver with address localhost:3000 and the Plugin from a webserver with address localhost:4000.

To do that, add these two lines to the "scripts" property of your application's package.json:

 ```json
  "scripts": {
  ...
    "start:webserver": "node ./node_modules/@bentley/imodeljs-webserver/lib/WebServer.js --port=3000 --resources=./lib/webresources/",
    "start:pluginserver": "node ./node_modules/@bentley/imodeljs-webserver/lib/WebServer.js --port=4000 --resources=./lib/pluginserver/",
  ...
  }
```

The start:webserver entry starts the web server for the target application, assuming that it is built into the lib/webresources directory by the buildIModelJsModule script. The second line starts the web server for Plugins. The origin of that webserver is the lib/pluginserver directory. In that directory, you must create an imjs_plugins subdirectory. External Plugins are loaded from a directory with a relative path from the web server origin of imjs_plugins/\<pluginName\>.

Now, if you are building a plugin called myPlugin in a directory such as D:\jsprojects\myPlugin, and you configure buildIModelJsModules to build it to ./lib/build, you could symbolically link the build directory of the Plugin to the corresponding directory in the imjs_plugins directory. For example, in Windows:

```
cd lib\pluginserver\imjs_plugins
mklink /d myPlugin d:\jsprojects\myPlugin\lib\build
```

Now you can start the two web servers:

```
npm run start:webserver
npm run start:pluginserver
```

Open a web browser, navigate to localhost:3000, and once your application is running, you should be able to start your Plugin by calling PluginAdmin("localhost:4000/myPlugin). If you are running the application built for development, the browser's debugging tools will find the source map for your application and for your Plugin.

Since you made a symbolic link to the build directory, there is no need to copy files when you make changes in myPlugin. Simply rebuild it using buildIModelJsModule and the changes will be reflected in the web server. There is no need to restart either web server, simple reload the application from localhost:3000 and load the plugin again.

#### 1b - Target Application on a web server.

If you are developing a Plugin for an application that is hosted on the internet, rather than locally, you can still use web server running on your own computer to deliver the Plugin. In that case, you proceed as above, except you add the script to start the web server in the Plugin's package.json rather than that of the application. Put @bentley/imodeljs-webserver into the "devDependencies" in your Plugin's package.json, and add this line to your "scripts" property:

```json
  "scripts": {
  ...
    "start:pluginserver": "node ./node_modules/@bentley/imodeljs-webserver/lib/WebServer.js --port=4000 --resources=./lib/pluginserver/",
  ...
  }
```
Create the lib/pluginserver/imjs_plugins directory, and symbolically link the myPlugin directory to the lib/build directory as before.

The same call to PluginAdmin as step 1a is used to start the Plugin.

Note: The technique of running the plugin web server from the Plugin directory (as used in Scenario 1b) can also be used in Scenario 1a, but the technique of running the plugin web server from the application directory (as used in Scenario 1a) allows multiple Plugins to be delivered from the plugin web server.

Note: If you are using @bentley/imodeljs-webserver to deliver your plugin, you do not have to worry about CORS issues - it is set up to permit CORS requests from any origin.

### 2 - Deploying the Plugin to an internet web server

The mechanics of installing the Plugin to a real internet web server will vary according to the web server in use and the mechanics of administering the web server. Often, you can use the tar file created while building the Plugin to simplify moving the files to the web server.

The requirements for a Plugin web server are:

- It must have an imjs_plugins directory from its resource root.
- It must allow Cross Origin requests (CORS) from the origin of the web server that delivers the application(s) that are to host the Plugin.
- Each Plugin that it is to deliver is put into a subdirectory of imjs_plugin that has the same name as the Plugin.
- The directory structure and files under the subdirectory structure must mirror the directory structure built by buildIModelJsModule (the directory specified by the ```iModeljs.buildModule.webpack.build``` property of package.json). That directory structure will be created if you extract the Plugin tarfile.

## CORS Considerations

When a Plugin is started by an iModel.js application, resources such as json files, javascript files, localization files, images, etc., get loaded from the web server that hosts the Plugin. When the Plugin is hosted on the same web server as the application itself, that is not a problem because all those resources are coming from the same origin. But when the Plugin is hosted by an external web server, those resource requests are "Cross Origin" resource requests, and therefore the browser requires that the Plugin web server specifically allow such requests.

The technique for administering a web server to allow CORS requests depends on the particular web server.

Javascript Express-based web servers are not externally administered. The programmer must install middleware to allow CORS.

For Apache2 web servers, we have found that creating an .htaccess file in the imjs_plugins directory and putting these lines into it has worked (although there is a lot of variation between Apache2 installations, so your mileage may vary):

.htaccess contents:

```
# From https://stackoverflow.com/questions/14467673/enable-cors-in-htaccess

# Enable cross domain access control
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
Header always set Access-Control-Allow-Headers "x-test-header, Origin, X-Requested-With, Content-Type, Accept"

RewriteEngine On
RewriteCond %{REQUEST_METHOD} OPTIONS
RewriteRule ^(.*)$ blank.php [QSA,L]
```

The "*" in the first "Header always" line indicates that CORS requests are permitted from all servers. You can make that less permissive by specifying the web servers that you want to allow.

Azure Web Servers have an administration page that sets up CORS permissions.

## Source Code Modifications

There are only a few modifications required to allow a Plugin to run successfully from an external web server, and all of them are concerned with properly requesting resources.

Localization files, for example, are external resources, so the code within the Plugin must request its resources using an instance of [I18N]($i18n) that is particular to the Plugin. iModelJs configures the I18N instance on behalf of the Plugin and it is accessed as the "i18n" instance property of the Plugin. For example, this code might appear in the Plugin:

```typescript
  /** Invoked the first time this plugin is loaded. */
  public onLoad(_args: string[]): void {
    this._i18NNamespace = this.i18n.registerNamespace("WmsPlugin");
    this._i18NNamespace!.readFinished.then(() => {
      IModelApp.tools.register(OurFirstTool, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(OurSecondTool, this._i18NNamespace, this.i18n);
    ...
  }

  /** Invoked each time this plugin is loaded. */
  public onExecute(_args: string[]): void {
    ...
    // For demonstration purposes, switch the imagery type each time the plugin is executed.
    this._currentImageryType = (WMSImageryType.Temperature === this._currentImageryType) ? WMSImageryType.Precipitation : WMSImageryType.Temperature;

    // Output a message indicating the current imagery type.
    const weatherType = (WMSImageryType.Temperature === this._currentImageryType) ? "temperature" : "precipitation";
    this._i18NNamespace!.readFinished.then(() => {
      const message: string = this.i18n.translate("WmsPlugin:Messages.DisplayType", { weatherType });
      const msgDetails: NotifyMessageDetails = new NotifyMessageDetails(OutputMessagePriority.Info, message);
      IModelApp.notifications.outputMessage(msgDetails);
    }).catch(() => { });
  }
```

In the ```onLoad``` method, an i18n Namespace is registered, and tools that are implemented in the plugin are registered with the optional third argument (this.i18n). In the ```onExecute``` method, a string from the plugin's internationalization object and namespace is accessed.

Similarly, a slight code modification is needed for loading other resources from the Plugin's web server. For example, suppose we want to load an .svg file for use in a Plugin. The following code in ```onLoad``` is used:

```typescript
  /** Invoked the first time this plugin is loaded. */
  public onLoad(_args: string[]): void {
    ...
    this._logoImage = new Image();
    this._logoImage.src = this.resolveResourceUrl("wmsPlugin.svg");
    this._logoImage.width = this._logoImage.height = 64;
    ...
  }
```

The ```resolveResourceUrl``` method returns a URL that builds the web server address into the relative resource passed as the string argument.

Note that the code above also works for Plugins hosted directly on the application's web server. In that case the Plugin's i18n property is equivalent to iModelApp.i18n, and the resolveResourceUrl method simply returns its argument.
