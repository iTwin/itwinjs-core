# AppUi Test App

## About this Application

The application contained within this directory provides a test environment for developers working on react based AppUI functionality of iTwin.js. It is `not` intended to serve as an example or template for the design of "real" iTwin.js applications.

## Getting Started

The application may be run as an Electron app, Mobile app or within a browser. The following steps outline the procedure for successfully building the application as part of a larger monorepo, and then starting the application via npm scripts.

1. To get started, follow the instructions to setup the entire repository, located [here](../../README.md#Build\ Instructions).
2. Optionally, set other environment variables to configure the application prior to startup. The full list of supported variable are [below](#environment-variables).
3. Build the application code using `buildapp` script (`build` is reserved for rush overall builds, we use a different script to build this application backend to reduce normal builds):

    ```cmd
    npm run buildapp
    ```

* To start the application in Electron, navigate to the `standalone` directory under appui-test-app, and use the command:

  ```cmd
  npm run start
  ```

* To start the application in a browser, run the following command, and then navigate to localhost:3000 in any supported browser:

  ```cmd
  npm run start:servers
  ```

Note: The environment variable `IMJS_UITESTAPP_SNAPSHOT_FILEPATH` must be set if start:servers is used to start browser app. This is due to  browsers only returning the selected file name and not the entire selected file path.

## Dependencies

* Installed dependencies for appui-standalone-app may be found in the generated node_modules directory. Since appui-standalone-app is but a part of a larger monorepo, the dependencies here are provided as symlinks into a master node_modules directory managed by the build tool Rush.
* Any changes made to itwinjs-core files outside of this directory will not immediately be reflected in appui-standalone-app. The entire itwinjs-core monorepo must be rebuilt in order for changes to take effect.
* If dependencies have changed after pulling the most recent version of itwinjs-core, it is often necessary to do a clean reinstall of all dependencies in order to avoid build errors.

```cmd
rush install -c
```

## Environment Variables

You can use these environment variables to alter the default behavior of various aspects of the application.

To set the environment variables, either set them directly within the terminal you start the test app or create a `.env` file as a peer to this README.

### Common variables

* IMJS_UITESTAPP_SNAPSHOT_FULLPATH
  * Optional variable used to immediately open the specific snapshot file from local disk as soon as app starts.
* IMJS_UITESTAPP_IMODEL_VIEWID
  * Optional variable to define the Id of the view to display. If not specified or not found in file, a default view Id is located used.
* IMJS_TESTAPP_REACT_AXE_CONSOLE
  * If defined, open the AXE console for React.
* IMJS_MAPBOX_KEY
  * If defined, sets the MapBox key for the `MapLayerOptions` as an "access_token".
* IMJS_BING_MAPS_KEY
  * If defined, sets a Bing Maps key within the `MapLayerOptions` as a "key" type.
* IMJS_CESIUM_ION_KEY
  * If defined, the API key supplying access to Cesium ION assets.

### Electron-only

* IMJS_NO_DEV_TOOLS
  * If defined, do not open the electron dev tools on startup

### Browser-only

* IMJS_UITESTAPP_SNAPSHOT_FILEPATH
  * Set to folder containing .bim or .ibim files. Since file picker in browser only returns the file name and not the path, this variable defines the directory that holds bim files and will be pre-pended to the select file name. This is required in running app in browser and IMJS_UITESTAPP_SNAPSHOT_FULLPATH is not defined.

### URL parameters

*Optionally* used to load an application in a specific configuration:

* `frontstage` - opens a frontstage by specified frontstage id, uses a blank connection. I.e. <http://localhost:3000/?frontstage=appui-test-providers:WidgetApi>
