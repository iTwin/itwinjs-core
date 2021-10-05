# UI Test App

## About this Application

The application contained within this directory provides a test environment for developers working on react based AppUI functionality of iTwin.js. It is `not` intended to serve as an example or template for the design of "real" iTwin.js applications.

## Getting Started

The application may be run as an Electron app, Mobile app or within a browser. The following steps outline the procedure for successfully building the application as part of a larger monorepo, and then starting the application via npm scripts.

* To get started, follow the instructions to setup the entire repository, located [here](../../README.md#Build\ Instructions).

* Before starting ui-test-app, there are optional environment variables that may be set to be recognized by the application upon startup. For a full list, [see below](#environment-variables).

* To start the application in Electron, navigate to the root of display-test-app, and use the command:

```cmd
npm run start
```

* To start the application in a browser, run the following command, and then navigate to localhost:3000 in any supported browser (not Internet Explorer):

```cmd
npm run start:servers
```

## Dependencies

* Installed dependencies for ui-test-app may be found in the generated node_modules directory. Since ui-test-app is but a part of a larger monorepo, the dependencies here are provided as symlinks into a master node_modules directory managed by the build tool Rush.
* Any changes made to itwinjs-core files outside of this directory will not immediately be reflected in ui-test-app. The entire itwinjs-core monorepo must be rebuilt in order for changes to take effect.
* If dependencies have changed after pulling the most recent version of itwinjs-core, it is often necessary to do a clean reinstall of all dependencies in order to avoid build errors.

```cmd
rush install -c
```

## Environment Variables

You can use these environment variables to alter the default behavior of various aspects of the application.

To set the environment variables, either set them directly within the terminal you start the test app or create a `.env` file as a peer to this README.

* IMJS_UITESTAPP_IMODEL_NAME
  * Set the iModel to open when the app starts. The Project Name variable is required for this one to properly work and the iModel to be opened
* IMJS_UITESTAPP_PROJECT_NAME
  * Set the Project to open when the app starts. The iModel Name variable is required for this one to properly work and the iModel to be opened.
* IMJS_UITESTAPP_IMODEL_VIEWID
  * Opens the provided iModel to the viewId, otherwise IModelIndex page is used.
* IMJS_UITESTAPP_SNAPSHOT_FILEPATH
  * Set to folder containing .bim or .ibim files (required)
* IMJS_UITESTAPP_START_WITH_SNAPSHOTS
  * Set to 1 to start with File Open dialog (optional)
* IMJS_UITESTAPP_GP_BACKEND
  * (Browser and online - only) Setup the ui-test-app to use the iTwin Platform Visualization service for the backend instead of using a local backend.
* IMJS_UITESTAPP_ALLOW_WRITE
  * Editing Support - set to 1. If not defined, false is assumed. WARNING: this is strictly used to test the UI when editing is enabled
* IMJS_UITESTAPP_USE_LOCAL_SETTINGS
  * Store settings in LocalStorage instead of Project Settings Service

* IMJS_NO_DEV_TOOLS
  * If defined, do not open the electron dev tools on startup
* IMJS_MAPBOX_KEY
  * If defined, sets the MapBox key for the `MapLayerOptions` as an "access_token".
* IMJS_BING_MAPS_KEY
  * If defined, sets a Bing Maps key within the `MapLayerOptions` as a "key" type.
* IMJS_CESIUM_ION_KEY
  * If defined, the API key supplying access to Cesium ION assets.
* IMJS_URL_PREFIX
  * Appends a prefix to all urls calling the iTwin Platform.

* IMJS_OIDC_ELECTRON_TEST_CLIENT_ID
  * (Required for Electron)
* IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI
  * (Required for Electron)
* IMJS_OIDC_ELECTRON_TEST_SCOPES
  * (Required for Electron)

* IMJS_OIDC_BROWSER_TEST_REDIRECT_URI
  * (Required for Web)
* IMJS_OIDC_BROWSER_TEST_CLIENT_ID
  * (Required for Web)
* IMJS_OIDC_BROWSER_TEST_SCOPES
  * (Required for Web)
