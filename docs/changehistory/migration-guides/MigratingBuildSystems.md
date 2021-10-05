# Migrating to the new iModel.js Application Build System

The iModel.js 1.0 build system all applications relied on a single package (`@bentley/webpack-tools`) to build iModel.js backends, frontends and extensions. With the release of 2.0, there are significant improvements to the build system to help with both clarity and usability to enable creating an app based on the latest technologies easier. To aid in this, the build system is now split into 3 separate components:

- The general build tools still reside in the [@itwin/build-tools](https://www.npmjs.com/package/@itwin/build-tools) package.
- iModel.js Extensions (formerly Plugins) are now bundled using Webpack with `@bentley/extension-webpack-tools`
- The iModel.js frontend build system is now based on [Create-React-App](https://create-react-app.dev/).

## Background on the switch to Create-React-App

Create-react-app (CRA) is one of the most popular ways to start writing React applications and is maintained by Facebook (the creators/maintainers of React). There are many more details about CRA and how it works on their [website](https://create-react-app.dev/).

The main part of create-react-app's build system is the package [react-scripts](https://www.npmjs.com/package/react-scripts) which holds all of the webpack/build configuration that is used by CRA and therefore most react-based applications. In order to support iModel.js applications, a fork has been created of the [create-react-app](https://github.com/imodeljs/create-react-app) repository specifically for a few changes to the webpack configuration in react-scripts. For more information on the exact changes made in the fork, and why they were considered necessary, check out the [README](https://github.com/imodeljs/create-react-app/blob/master/README-imodeljs.md).

One of the main principles of CRA is in the source tree of the app there is a `src` folder with an `index.ts` at the root of the folder, as the entry point of an app, and a `public` folder with a `index.html` at the root.

Everything within the `src` folder is included in the webpack process, including all of the assets that are parsed via loader (i.e. scss, css, json, etc.), and everything in the `public` folder is expected to live at the webroot when it's deployed so it's copied into the build output appropriately.

## Step by step guide

With the above background in mind, the quickest/easiest migration pattern for all existing apps that are currently using the iModel.js module system is broken down into the following set of steps.

1. Add a dependency on `@bentley/react-scripts` and remove the dependency on `@bentley/webpack-tools`
   - This is the aforementioned fork of the create-react-app webpack configuration
1. Move the current `index.html`, that now most likely lives within `src/frontend/index.html`, to `public/index.html`.
1. Update the `index.html` to remove the following lines,

   ```html
   <!-- check the browser to verify it is supported. -->
   <script
     type="text/javascript"
     src="v<%= htmlWebpackPlugin.options.loaderVersion %>/checkbrowser.js"
   ></script>

   <script
     type="text/javascript"
     src="v<%= htmlWebpackPlugin.options.runtimeVersion %>/runtime.js"
   ></script>
   <script
     type="text/javascript"
     src="v<%= htmlWebpackPlugin.options.loaderVersion %>/IModelJsLoader.js"
     data-imjsversions="<%= htmlWebpackPlugin.options.imjsVersions %>"
   ></script>
   ```

   and replace them with,

   ```html
   <script
     type="text/javascript"
     src="%PUBLIC_URL%/scripts/checkbrowser.js"
   ></script>
   ```

1. Add a `src/index.ts` file with an import to the current entry point of the app within `src/frontend`. For example if the entry point is currently `./src/frontend/index.ts`, then the new `./src/index.ts` will be as simple as the new [ui-test-app/src/index.ts](https://dev.azure.com/bentleycs/iModelTechnologies/_git/imodeljs/pullrequest/74170?_a=files&path=%2Ftest-apps%2Fui-test-app%2Fsrc%2Findex.ts) file.
1. Remove the `iModelJs.buildModule` from the `build` script in `package.json` and replace call to `buildImodelJsModel` with `react-scripts build`.
1. Add a `browserslist` section to the package.json

   ```json
   "browserslist": [
     "electron 6.0.0",
     "last 4 chrome version",
     "last 4 firefox version",
     "last 4 safari version",
     "last 4 ios version",
     "last 4 ChromeAndroid version",
     "last 4 edge version",
     "not dead",
     "not <0.2%"
   ]
   ```

1. Add a separate `tsconfig.json` for backend build called `tsconfig.backend.json`.

   - The build between the frontend and backend are now slightly different in their configuration meaning that an app now needs two separate tsconfigs
   - The contents of the `tsconfig.backend.json` should be similar to the following:

     ```json
     {
       "extends": "./node_modules/@itwin/build-tools/tsconfig-base.json",
       "compilerOptions": {
         "target": "es2017",
         "module": "commonjs",
         "outDir": "./lib"
       },
       "include": ["./src/backend/*.ts", "./src/common/*.ts"],
       "exclude": ["lib", "node_modules"]
     }
     ```

## FAQ

- Receiving an out-of-memory exception when running `react-scripts build`?

  > FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory

  This is most likely the result of generating sourcemaps for the application. There are known issues in create-react-app of the sourcemap generation causing memory issues on large projects.

  To workaround the issue either,

  - Set the following environment variable, `GENERATE_SOURCEMAPS=false`. The documentation about this and other react-scripts configurations are available on their [advanced configuration page](https://create-react-app.dev/docs/advanced-configuration).
  - Or, increase the Node heap size by adding the `--max_old_space_size=4096` argument, like `react-scripts --max_old_space_size=4096 build`

- What happens to the `config.json`?

Previously iModel.js dynamically pulled a config.json file from the same web origin as the rest of the assets to provide the configuration. This has been changed to follow create-react-app's way of handling configuration
