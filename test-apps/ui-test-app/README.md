# AppUi Test App

## About this Application

The application contained within this directory provides a test environment for developers working on react based AppUI functionality of iTwin.js. It is `not` intended to serve as an example or template for the design of "real" iTwin.js applications.

## Getting Started

The application may be run as an Electron app, Mobile app or within a browser. The following steps outline the procedure for successfully building the application as part of a larger monorepo, and then starting the application via npm scripts.

1. To get started, follow the instructions to setup the entire repository, located [here](../../README.md#Build\ Instructions).
2. If you want to work online, follow the configure the [client application section](#client-configuration).
    > If you intend to use the ui-test-app offline with a snapshot iModel, you can safely ignore these instructions. When prompted to sign-in click the "Work offline" button.
3. Optionally, set other environment variables to configure the application prior to startup. The full list of supported variable are [below](#environment-variables).

Note: Before running `ui-test-app` for the first time, use the command `npm run build:ci` from the `ui-test-app` directory to ensure all assets are properly displayed when running locally.

* To start the application in Electron, navigate to the root of ui-test-app, and use the command:

  ```cmd
  npm run start
  ```

* To start the application in a browser, run the following command, and then navigate to localhost:3000 in any supported browser:

  ```cmd
  npm run start:servers
  ```

* To start the application as an iOS app, run the following: WIP

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

### Common variables

* IMJS_UITESTAPP_IMODEL_NAME
  * (Online-only) Set the iModel to open when the app starts. The iTwin Name variable is required for this one to properly work and the iModel to be opened
* IMJS_UITESTAPP_ITWIN_NAME
  * (Online-only) Set the iTwin to open when the app starts. The iModel Name variable is required for this one to properly work and the iModel to be opened.
* IMJS_UITESTAPP_IMODEL_VIEWID
  * (Online-only) Opens the provided iModel to the viewId, otherwise IModelIndex page is used.
* IMJS_UITESTAPP_SNAPSHOT_FILEPATH
  * Set to folder containing .bim or .ibim files (required)
* IMJS_UITESTAPP_START_WITH_SNAPSHOTS
  * Set to 1 to start with File Open dialog (optional)
* IMJS_UITESTAPP_ALLOW_WRITE
  * Editing Support - set to 1. If not defined, false is assumed. WARNING: this is strictly used to test the UI when editing is enabled
* IMJS_UITESTAPP_USE_LOCAL_SETTINGS
  * Store settings in LocalStorage instead of Project Settings Service

* IMJS_MAPBOX_KEY
  * If defined, sets the MapBox key for the `MapLayerOptions` as an "access_token".
* IMJS_BING_MAPS_KEY
  * If defined, sets a Bing Maps key within the `MapLayerOptions` as a "key" type.
* IMJS_CESIUM_ION_KEY
  * If defined, the API key supplying access to Cesium ION assets.

### Electron-only

* IMJS_NO_DEV_TOOLS
  * If defined, do not open the electron dev tools on startup
* IMJS_OIDC_ELECTRON_TEST_CLIENT_ID
  * (Required for online)
* IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI
  * (Required for online)
* IMJS_OIDC_ELECTRON_TEST_SCOPES
  * (Required for online)

### Browser-only

* IMJS_OIDC_BROWSER_TEST_REDIRECT_URI
  * (Required for Web)
* IMJS_OIDC_BROWSER_TEST_CLIENT_ID
  * (Required for Web)
* IMJS_OIDC_BROWSER_TEST_SCOPES
  * (Required for Web)
* IMJS_UITESTAPP_GP_BACKEND
  * (Online - only) Setup the ui-test-app to use the iTwin Platform Visualization service for the backend instead of using a local backend.

## Client Configuration

To use the ui-test-app with iModels and other services in the iTwin Platform, a client needs to be registered and configured within the developer portal.

If you do not already have an existing client ([here](https://developer.bentley.com/my-apps/)), please jump to the steps for [registering a new client](#register-new-client).

If you do have an existing client, set the following environment variables with the appropriate info depending the type of app you're attempting to run, or all of them if you'd like to run the app in each mode:

* For Web, use a client that is "Type" `SPA` and set the following variables
  * IMJS_OIDC_BROWSER_TEST_CLIENT_ID
  * IMJS_OIDC_BROWSER_TEST_REDIRECT_URI
    * By default set this to `http://localhost:3000/signin-callback`
  * IMJS_OIDC_BROWSER_TEST_SCOPES
    * By default set this to `openid profile organization email itwinjs projects:read`
* For Electron/Desktop, use a client that is "Type" `Desktop/Mobile` and set the following variables
  * IMJS_OIDC_ELECTRON_TEST_CLIENT_ID
  * IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI
    * By default set this to `http://localhost:3000/signin-callback`
  * IMJS_OIDC_ELECTRON_TEST_SCOPES
    * By default set this to `openid profile organization email itwinjs offline_access projects:read`

> Note: In the Web case, if you change the PORT of the frontend then you will also need to update the redirect_uri in both the Developer Portal and the `IMJS_OIDC_BROWSER_TEST_REDIRECT_URI` variable to reflect the new port. The default port is `3000`.

### Register new client

Follow these steps to obtain a new OIDC client to use the ui-test-app depending on how you intend to use the application.

1. Navigate to the [My Apps](https://developer.bentley.com/my-apps/) page
    * If you are not already registered, click Register now and complete the registration process.
1. Click the Register New button
1. Give your application a Name
1. Select the Visualization API
1. Select application type based on type of application you would like to run
    * `SPA` or
    * `Desktop/Mobile`
1. Enter Redirect URI <http://localhost:3000/signin-callback>
1. Enter Post logout Redirect URI: <http://localhost:3000>.
1. Click the Save button
