# iTwin.js Extensions

An iTwin.js Extension is a separate JavaScript module that can load on demand into an iTwin.js frontend application.
The separate deliverable enables Extensions to provide extensibility of an iTwin.js application without having to re-bundle the application.
Extensions have access to a limited subset of iTwin.js functionality through `@itwin/core-extension` to enable seamless integration with the host app.

## What can extensions do?

Extensions can be used for many different purposes, such as:

- Add a new [decorator](./ViewDecorations.md) to an existing application to better support your custom workflows.
- Write event based processing, i.e., subscribe to an iModel Event, or Unified Selection Event, and process that change.

## How to get started

An iTwin.js Extension at a minimum is a single JavaScript file and a manifest (i.e., a package.json file with some additional properties).
To get started, create a new directory for the Extension.

### Setup the Manifest

The first step to creating an extension is to create a manifest.
Create the `package.json` by running, in the directory created above:

```
npm init --yes
```

The following properties must be added to the package.json file:

- _Name_: the name of the Extension.
- _Version_: the version of the Extension in the format _x.x.x_.
- _Main_: where to find the javascript file.
- _ActivationEvents_: events that define when the iTwin.js application should execute your Extension. Currently, we only support `onStartup`, which will execute the Extension as soon as it is added to the application.

Here is a minimal example:

```json
// package.json
{
  "name": "my-new-extension",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "type": "module",
  "activationEvents": [
    "onStartup"
  ]
}
```

Next, you'll want to add [TypeScript](https://www.typescriptlang.org/), and the required dependencies for developing with the iTwin.js shared libraries:

```json
  // package.json
  "dependencies": {
    "@itwin/core-extension": "^3.2.0"
  },
  "devDependencies": {
    "typescript": "~5.0.2",
    "@itwin/build-tools": "^3.2.0",
  },
```

A basic tsconfig.json file needs to be setup for development. Create a new tsconfig.json file next to the package.json with the following contents:

```json
// tsconfig.json
{
  "extends": "./node_modules/@itwin/build-tools/tsconfig-base.json",
  "include": ["./*.ts", "./*.tsx"]
}
```

Next, add your favorite JavaScript tool to bundle your code together.
Bundling is the process of combining multiple small source files into a single file.
Bundling is necessary because when Extensions are loaded by the host iTwin.js application, they can only load and execute one file at a time.
It is also a good idea to make the file as small as possible, a process known as minification.
For JavaScript, popular bundlers are [rollup.js](https://rollupjs.org/guide/en/), [esbuild](https://esbuild.github.io/), and [webpack](https://webpack.js.org/). Here is an example using esbuild:

```
npm i --save-dev esbuild @esbuild-plugins/node-modules-polyfill @esbuild-plugins/node-globals-polyfill
```

Add the following entry into the scripts section in package.json to build the final bundle:

```json
// package.json
  "scripts": {
    "build": "node esbuild.js"
  }
```

And finally, an esbuild configuration file (esbuild.js) should be placed next to the package.json.
The configuration tells esbuild to bundle and minify the files, as well as adds some necessary polyfills:

```js
// esbuild.js
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import path from "path";
import esbuild from "esbuild";
import { fileURLToPath } from "url";
import { argv } from "process";

const dir = path.dirname(fileURLToPath(import.meta.url)).replace(/\\/g, "/");
const arg = argv.length > 2 ? argv[2] : undefined;

esbuild
  .build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    minify: true,
    define: { global: "window", __dirname: `"${dir}"` },
    outfile: "dist/index.js",
    plugins: [new NodeGlobalsPolyfillPlugin(), new NodeModulesPolyfillPlugin()],
    format: "esm",
    loader: {
      ".svg": "dataurl",
      ".woff": "dataurl",
      ".eot": "dataurl",
      ".ttf": "dataurl",
      ".woff2": "dataurl",
      ".cur": "dataurl",
      ".png": "dataurl",
    },
  })
  .catch(() => process.exit(1));
```

### Creating the Extension

The only requirement when creating an Extension is to define a default function.
The default function will execute on the Extension's activation event.
The function would run immediately if onStartup was specified as the Activation Event.
For example:

```tsx
// src/index.ts
export default function main() {
  console.log("Hello from Extension!");
}
```

The above would print "Hello from Extension!".

We can extend functionality by adding, for example, adding some decorators representing IoT devices, and when clicked will navigate to a specific view.
First, we will query for all ceilings, walls, windows, etc, and hide them from the view.
Then, we will query for all IoT devices, and add a decorator for each one.

_IotMarkerExtension.ts:_

``` ts
[[include:ExtensionSample-IotMarkerExtension.example-code]]
```

_SmartDeviceDecorator.ts:_

``` ts
[[include:ExtensionSample-SmartDeviceDecorator.example-code]]
```

_SmartDeviceMarker.ts:_

``` ts
[[include:ExtensionSample-SmartDeviceMarker.example-code]]
```

_index.ts:_

``` ts
[[include:ExtensionSample-main.example-code]]
```

The final file structure should look something like this:

```txt
my-itwin-extension
│   package.json
│   esbuild.js
│   tsconfig.json
│
└───assets
└───src
│   │   index.ts
│   │   IotMarkerExtension.ts
│   │   SmartDeviceDecorator.ts
│   │   SmartDeviceMarker.ts
│
└───dist
    │   index.js
```

### Loading an Extension into an iTwin.js Application

Extensions need to be served somewhere so that the iTwin.js application can load the Extension at runtime.
> A useful way to serve JavaScript locally is to add [serve](https://www.npmjs.com/package/serve) as a dev dependency `npm i --save-dev serve`, then adding a script to your package.json: `"serve": "serve . -p 3001 --cors"`.

By default, every [IModelApp](./IModelApp.md) has an instance of the `ExtensionAdmin`.
The ExtensionAdmin controls the loading and execution of Extensions.
An Extension **must** be added to `ExtensionAdmin` through an `ExtensionProvider` before it can be executed.

In the following example we add an Extension served at localhost:3001 through a `RemoteExtensionProvider`.
You can also load Extensions locally as if they were npm packages through the `LocalExtensionProvider`.

```ts
const extensionProvider = new RemoteExtensionProvider({
  jsUrl: "http://localhost:3001/dist/index.js",
  manifestUrl: "http://localhost:3001/package.json",
});
```

The next step is to register your host with the ExtensionAdmin. The ExtensionAdmin will only load Extensions from registered hosts.

```ts
IModelApp.extensionAdmin.registerHost("localhost:3001");
```

The last step is to add the Extension to the ExtensionAdmin. Once the Extension has been added, its default function will immediately execute if the onStartup Activation Event was defined in the manifest.

```ts
IModelApp.extensionAdmin.addExtension(extensionProvider)
  .catch((e) => console.log(e));
```
