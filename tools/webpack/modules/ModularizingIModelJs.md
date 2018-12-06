# Modularizing iModel.js

In most runtime environments, a large application is divided into multiple 'modules' that are loaded separately to perform different portions of the task at hand. The organization is generally an acyclic graph, where "lower-level" modules perform simpler tasks, while "higher-level" modules build on those lower-level modules to perform more complicated tasks.

For example, most Windows native programs consist of an executable (.exe) file which requires a potentially large set of Dynamic Link Libraries (DLLs). The DLLs can either be loaded immediately upon startup, or loaded on an "as-needed" basis as the application runs. An alternative is to statically link all the code from the libraries into one large executable. The latter option has the disadvantage of making the program very large, and also "closing" the system since additional DLLs are not able to access code statically linked in, as they can when the program consists of separate DLLs.

For a variety of reasons, large JavaScript (/TypeScript) applications have tended to use a "bundler" such as webpack to create one large JavaScript file - i.e., the static linking model rather than the DLL model. Up until now, that is the approach we have used for iModel.js. This has the same disadvantages alluded to above - every iModel.js application bundles in a copy of all the iModel.js code, and that bundle is a closed system, so there is no way of loading additional code at runtime that can access the capabilities provided by the iModel.js API.

Therefore, that deployment model does not take advantage of the careful organization of the iModel.js source code, which is logically separated into packages that make ideal candidates for separately loaded modules. So an obvious objective is to change our bundling policy to make each package into a loadable module.

## Advantages to Modularizing

There are a number of advantages to creating a separately loadable module for each of our packages:

1. We (and our users and third-party developers) will have many iModel.js applications. The system iModel.js modules can be shared by multiple such applications. They can be delivered to the browser by a simple web server or by a content delivery network (CDN). They can also be loaded directly from the browser cache if they have been previously downloaded.

2. We (and our users and third-party developers) can develop plugins for our applications that can be loaded dynamically. Such plugins are webpacked as external modules, using the exact same method that we use to webpack our packages as modules, and then loaded into the browswer or Electron environment that already has the iModel.js modules loaded. The plugins can be very small if they add only simple functionality, or quite large if necessary.

3. Faster startup time during development. Our previous development environment used the webpack development server for most of our test programs (e.g. ui-test-app). In that case, each time a browser application is started, it is webpacked into memory from the ground up, a process that can take several minutes. With the application and our packages modularized and webpacked to disk, startup is very fast.

4. Faster build times. If you are working on only one package, only that module needs to be built and webpacked after you make a change. That is fast, and then you just reload the application. (To be fair, though, using webpack-dev-server is also quite efficient in that case, and has some advantage with hot module replacement. We are hoping to get the best of both worlds eventually).

5. Better alignment with HTTP/2, which allows parallel HTTP requests and hence parallel loading of modules.

There are probably advantages to be gained by further optimizing our loading strategy - see the [Loading Modules at Runtime](#loading-modules-at-runtime) section below.

## Making a Package into a Module

JavaScript has a confusing array of "module" systems, because of its chaotic evolution from a simple scripting language to a credible development environment. ES2015 and later version of JavaScript have a builtin module system, the syntax of which we make extensive use of in our source. Every "import" statement in our source code (sort of) makes use of this ES2015 module system. The TypeScript transpiler looks at the "source" for the imported module. It's either another TypeScript file (if it is specified with a full file specification), or it's the ".d.ts" typings file when the TypeScript transpiler doesn't have access to actual TypeScript source. The information from those files is used to enforce type safety at compile time. Since JavaScript sources have no transpiler step, no use is made of the import statements until runtime. But runtime is when it get tricky, because there are multiple runtime environments with differing levels of support for ES2015 modules. Since the 8.x version of Node doesn't support ES2015 modules, we have typescript configured to transpile all "import" statements to "require" statements in the output javascript files. The require syntax is from the older "CommonJs" module system that Node does support. You can look at the .js files in our output "lib" directories to see that substitution.

We wouldn't want each of our source files to be separately loaded modules even if all of our runtime environments supported ES2015 modules. There would be way too many of them and nobody would be able to figure out how they were organized. As mentioned above, a good structure is to bundle the source files from each of our packages into a separately loaded JavaScript module. Actually, we are concerned only with the  frontend modules (those that are used in the browser), as those are the ones that are downloaded to clients using the HTTP protocol. Backend modules are loaded by Node using file system reads, so there is less to be gained by having fewer of them.

## Webpacking Modules

The following describes some details of how Webpack works (at least as of November 2018). You can skip to the [Source Code Requirements for Modularization](#source-code-requirements-for-modularization) section if you are not interested in these details.

The Webpack documentation differentiates between "bundles" and "modules" as described below.

### Bundles

 A webpacked application can have multiple bundles that separate its contents into more than one file. That concept is not of interest in our application because the bundles that result from a particular execution of webpack can only be used by other bundles from that particular execution of webpack. Sometimes, when only some of the source files are changed, individual bundles don't change, and there is a long discussion of how unchanged bundles can be cached, etc., but that is not our only goal - we want modules that can be shared across applications. The discussion of something they call "DllPlugin" is misleading - it doesn't create shareable modules, it is just about making webpack bundle faster when there are portions of the code that don't change often.

### Modules

The discussion in the [Webpack Modules](https://webpack.js.org/concepts/modules/) portion of the documentation  is highly relevant to our goals. It describes a way to webpack code into a JavaScript module that can be output as a Universal Module Definition (UMD) file, which means that it can be loaded into various JavaScript environments that support different varieties of modules - CommonJs, Asynchronous Module Definition (AMD), and ES2015 modules. This is accomplished by putting a JavaScript header into the bundled file with the appropriate logic for figuring out which module system is trying to load it and responding accordingly.

To use separately webpacked modules in a webpacked application (for example, to  use our iModel.js modules in our applications), they are specified in the "externals" key of the webpack configuration object.

Unfortunately, the Webpack Module is not an exact match for our requirements. By default, it is oriented towards small modules that have a shallow dependency tree on other external modules (or are not dependent on any other external modules). That is not the case we have - our modules have a pretty deep dependency stack that looks something like this, with each module possibly dependent on multiple modules above it in this list:

```javascript
bentleyjs-core
geometry-core
iModel.js-i18n
iModel.js-clients
iModel.js-common
iModel.js-quantity
iModel.js-frontend
ui-core
ui-components
ui-framework
ui-ninezone
presentation-common
presentation-components
presentation-frontend
```

The culprit that makes the default webpack module concept unsuitable for our case is its inherent assumption that each webpack module loads all of its dependents for its exclusive use. That is because (again, by default) each run of webpack creates a "runtime" function that resolves the modules that it needs. To do that it keeps a map of other modules that were loaded while it is loading, so if it encounters a module multiple times it doesn't duplicate it. But each such module is treated as a separate entity.

The problem with that, in our case, is that many of our modules will duplicate the dependencies of others of our modules. For example, almost all of them depend on bentleyjs-core. Therefore, we want all of our modules to share a runtime list of loaded modules. With some webpack configuration wrestling, that turns out to be possible, but it does take some source code discipline to make sure that we don't have duplicate relative file paths for files in different modules (for example, we can't have source files in two different packages that both have the same relative path, like "src/tree/index.js").

Other configuration requirements are documented via comments in webpackModule.config.js

## Source Code Requirements for Modularization

Here are some rules that our source code must follow to successfully build and use modules from our packages:

1. Any export that might be used from any other package or from an application *MUST* be put into the "barrel" file. The barrel file is the TypeScript file in the src directory that exports all the classes, function, enums, etc., from the other TypeScript files in the package, using statements like

    `export * from "./tools/AccuDrawTool.ts`

    In the past, we have sometimes omitted particular exports out of the barrel file if they are only meant for our internal use. For example, we might have a class in imodeljs-clients that we want to use from imodeljs-frontend, but we don't want to expose that class for general use. Previously, we could export the class in imodeljs-clients but keep it out of the barrel file, and then import that class where it was needed in the imodeljs-frontend package by specifying the full path to the transpiled file.  That can no longer be allowed - see Rule 2.

2. Import classes, functions, etc., from other packages using the barrel file exclusively. In other words, use:

   `import { IModelApp } from "@bentley/iModel.js-frontend";`

    rather than the previously-possible

   `import { IModelApp } from "@bentley/iModel.js-frontend/lib/IModelApp";`

    The reason for this is that webpack detects that you are intending to import the class or function from an external module by matching up the "@bentley/iModel.js-frontend" with the list of externals in the webpack configuration. If you specify the entire file, webpack doesn't interpret that as an external reference, and thus includes that (transpiled from TypeScript) JavaScript file into the current webpack. That would be bad enough, but it also doesn't recognize the imported file's imports from its home package (all of which will have the relative file name), and thus includes those, and recursively their imports, etc., until pretty soon all the source that we are trying to keep external from that module is pulled into its webpack.

3. Refrain from default exports. They cannot be imported from barrel files, so they can only be used from within the same package. Simply don't use them and import everything using the usual syntax.

4. Barrel files must be named uniquely across all packages (see the discussion in the Modules section above for why). Our newly-implemented convention is to name the barrel file the same as the package name, e.g., imodeljs-frontend.ts.

5. Put all exports into one export file; do not make "sub-barrel" files. In some of our packages, we have had "index.ts" files in subdirectories, and then we did something like `export * from "../[subdirname]"` which referenced that index file using TypeScript/JavaScripts defaulting. Don't do that, for the same reason as for Rule 4.

## Using Open Source Libraries as External Modules

A number of our packages, particularly those that provide UI components and the UI framework, make use of fairly large open source packages such as React and its associated packages. By using those as external modules rather than webpacking them into the modules that use them, we get the same advantages listed above for our own modules. In addition, they are readily available from CDNs, and they are frequently already in the browser cache, so download can be very quick or instantaneous. Here is a list of the open source packages that we use as external modules:

```javascript
react
react-dnd
react-dnd-html5-backend
react-dom
react-redux
redux
inspire-tree
lodash
```

I have written a tool that analyzes the JSON output of our webpacked modules to determine what modules to specify as external. There is no point in making a module external if it used by only one of our packages, or if it is small. The list of potential modules was smaller than I expected it to be. So far, these are the only ones that merit treatment as external.

## Building the IModel.js External Modules

The "rush build" command now webpacks each package into a separate module. There are separate modules built for development and production purposes. For efficiency during development, rush build creates only the development version. The "rush webpackModule-prod" command builds all of the production modules. All of the modules are webpacked using webpackModule.config.js. That script is specified as the --config argument to webpack-cli. Arguments are passed to it from "script" tags in package.json.

## Gathering External Modules for an IModel.js Application

For a browser application, the module files must be available to be delivered by a web server. There is a copyExternalModules script provided in the tools/webpack/modules directory that should be used to gather those external modules. It should be wired to one of the "script" entries in package.json with appropriate arguments (usually called "copy:modules"). The copyExternalModules script examines package.json file for dependencies and if a dependency is within the set of IModel.js external modules (including the open source external modules listed above), it symlinks them to the indicated destination directory. The IModel.js modules are symlinked to a subdirectory of the form `v<version>`, where version is read from the corresponding package.json. Currently, the script does not recurse through the dependencies of dependencies, so you must put all of the iModel.js packages that you need to be copied. For example, you might not have a direct dependence on imodeljs-quantity, but imodeljs-frontend does, so list that in the "dependencies" key of your package.json. For build simplicity, the "copy:modules" script should be incorporated into the "build" script so it is not forgotten. See test-apps/ui-test-apps/package.json for an example.

## Building Applications to Use External Modules>

An application that uses the IModel.js external module system should be built in the same way as the IModel.js external modules, so it has the correct webpack runtime. The easiest way to do that is to use the same webpackModule.config.js configuration script. See test-app/ui-test-app/package.json for an example.

## Loading Modules at Runtime

When a browser application relies on external modules, they must be loaded prior to the application module. A typical way to do that for single page applications (like most IModel.js applications) is to add script tags in the application's HTML template. The script tags have to be added in the correct order, because all of the dependents of a particular module must be loaded before it is loaded (hence the necessity of an acyclic dependency graph). Loading modules through script tags in that manner would require every application to put script tags for the entire set of modules in the correct sequence, and would require revision to each template HTML file whenever there was a change to the set of external modules, so instead there is an iModelJsLoader module that supervises the loading of all the other external modules. To use that loader, the application inserts two script tags into the `<head>` section of its HTML template:

  ```json
  <!-- use the IModelJs loader to load the system iModel.js modules -->
  <script type="text/javascript" src="runtime.bundle.js"></script>
  <script type="text/javascript" src="IModelJsLoader.js" data-imjsversion="0.170.0" data-uicomponents="true" data-uiframework="true"></script>
  ```

The first script tag loads the webpack runtime. This is built by the application (when it follows the webpack guidelines in the [Building Application to Use External Modules](#building-applications-to-use-external-modules) section above.

The [HTML data attributes](https://www.w3schools.com/tags/att_global_data.asp) pass arguments to the IModelJsLoader script. The version number must be set to the desired SemVer version of all the IModel.js external modules in the rush repository.

## Separating the Backend Server and Web Server

With the modularization changes described above, we can see a clear distinction between two different types of servers needed to support iModel.js.

The "backend server" needs access to an iModel briefcase, and supports the iModel.js frontend API's by providing the servcies through a remote procedure call (RPC) interface. If an application requires particular services, it can develop its own RPC protocol and implement it in the backend, so the backend server might be application specific. Native code is required to perform the services. All that means that an intelligent router is required to instantiate a virtual machine to run the code and instantiate the briefcase for it to use.

On the other hand, the resources needed by the web browser (the imodel.js system modules, application code, fonts, icons, images, SVG files, etc.) are static and can be delivered by any web server or a CDN.

To make that distinction more obvious, and to make our development environment more similar to the deployment environment, I have separated those responsibilities into two Express-based servers, and separated out the static resources from the backend code during the build. The static resources are now located in the "lib/webresources" directory and in development are delivered to the browser by using the command:

`node ./node_modules/@bentley/imodeljs-webserver/lib/webserver.js --port=3000 --resources=./lib/webresources/`

where the "port" and "resources" arguments specify the port used by the webserver and the location of the static resources.

Generally, it's easiest to put this as "start:webserver" into the "scripts" tag in your package.json:

`"start:webserver": "node ./node_modules/@bentley/imodeljs-webserver/lib/webserver.js --port=3000 --resources=./lib/webresources/"`

The script that starts the backend server is unchanged. Creating a script that starts both the static webserver and the backend server can be easily accomplished as follows:

`"start:servers": "run-p \"start:webserver\" \"start:backend\"",`

run-p runs both npm scripts in parallel. To use it, you must add "npm-run-all" to the devDependencies in your package.json file.

The code that configures the RPC configuration for your application needs a slight modification to specify the URL prefix since it is now separate from the web server's URL:

On the frontend:

```javascript
// Initialize my application gateway configuration for the frontend
let rpcConfiguration: RpcConfiguration;
const rpcInterfaces = getSupportedRpcs();
if (ElectronRpcConfiguration.isElectron)
    rpcConfiguration = ElectronRpcManager.initializeClient({}, rpcInterfaces);
else
    rpcConfiguration = BentleyCloudRpcManager.initializeClient({ info: { title: "ui-test-app", version: "v1.0" }, uriPrefix: "http://localhost:3001" }, rpcInterfaces);
```

On the backend, the port for the server is set with code like this:

```javascript
app.set("port", serverConfig.port);
```

Make sure it is set to match the `urlPrefix` specifed in the call to `BentleyCloudRpcManager.initializeClient`.

(Clearly this needs more work to be useful outside the development environment).

Once the servers are running, you can open a web browser and navigate to localhost:3000 to run the application.