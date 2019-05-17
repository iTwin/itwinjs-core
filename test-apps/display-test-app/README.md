# display-test-app Application

## About this Application

The application contained within this directory provides a test environment for developers working on the frontend functionality of iModel.js. It also serves as an example of how a consumer-made application depending on iModel.js may be designed.

* package.json
  * Provides the npm start script for the application
  * Identifies the overall dependencies (including union of backend, frontend, and other core dependencies)
* public/
  * Static HTML to be loaded into a canvas via Electron
  * CSS formatting
  * Assets (images, icons, fonts)
* frontend/
  * The main application body of code that runs on initialization of the Electron app, as well setting up event handlers for parts of the UI
  * Extended API functionality build on top of the imodeljs-core frontend dependency
* backend/
  * Specifications for initializing the Electron application, as well as event handlers for Electron events.

## Getting Started

The application may be ran as an Electron app, Mobile app or within a browser. The following steps outline the procedure for successfully building the application as part of a larger monorepo, and then starting the application via npm scripts.

* To get started, follow the instructions to setup the entire repository, located [here](../../README.md#Build\ Instructions).

* Before starting display-test-app, there are optional environment variables that may be set to be recognized by the application upon startup. For a full list, see [here](#Environment\ Variables).

* To start the application in Electron, navigate to the root of display-test-app, and use the command:
  ```
  npm run start:electron
  ```

* To start the application in a browser, run the following command, and then navigate to localhost:3000 in any supported browser (not Internet Explorer):
  ```
  npm run start:servers
  ```

## Using display-test-app

* Upon starting display-test-app, an initial iModel will automatically be loaded from the Hub (unless a local one was specified via an environment variable). From here, there are many tools in the top banner of the application that may be used.
* Users may open a new iModel by clicking the briefcase icon and navigating to a local file location.
* Users can switch between stored views via the view dropdown menu.
* The remaining tools contain ways to rotate the model, select parts of the view, undo and redo actions, and toggle on/off the camera as well as other view state settings.

## Debugging

Debugging display-test-app can be accomplished using the following procedures, depending on which packages of iModel.js you would like to step through:

* frontend
  * The frontend and common iModel.js core packages may be debugged simply by starting the addon using the steps listed in [Getting Started](#Getting\ Started), and then setting breakpoints within the Chrome developer tools window which will open automatically.
* backend
  * Calls to the imodeljs-backend functionality may be debugged by opening Visual Studio Code to the root of this repository, navigating to the debug tab, and selecting either 'display-test-app Electron (backend)' or 'display-test-app Browser (backend)' from the launch configuration dropdown. Note that in the browser configuration, only the web server will be started, and you must still manually navigate to the URL of the application in the browser (which is printed to the debug console). Any breakpoints for backend functionality set in Visual Studio Code will now be hit.

## Dependencies

* Installed dependencies for display-test-app may be found in the generated node_modules directory. Since display-test-app is but a part of a larger monorepo, the dependencies here are provided as symlinks into a master node_modules directory managed by the build tool Rush.
* Any changes made to imodeljs-core files outside of this directory will not immediately be reflected in display-test-app. The entire imodeljs-core monorepo must be rebuilt in order for changes to take effect.
* If dependencies have changed after pulling the most recent version of imodeljs-core, it is often necessary to do a clean reinstall of all dependencies in order to avoid build errors.
  ```
  rush install -c
  ```

## Environment Variables

* SVT_STANDALONE_FILENAME
  * Local path to an iModel, which will be the one opened by default at start-up.
* SVT_STANDALONE_FILEPATH
  * Allows SVT running in the browser to assume a common base path for ALL local standalone iModels (browser only).
* SVT_STANDALONE_VIEWNAME
  * The view to open by default within an iModel. This may only be used in conjunction with SVT_STANDALONE_FILENAME.
* SVT_STANDALONE_SIGNIN
  * If defined (value does not matter), and SVT_STANDALONE_FILENAME is defined, the user will still be required to sign in. This enables access to content stored on the reality data service. As a side effect, you may observe a harmless "failed to fetch" dialog on startup, which can be safely dismissed.
* SVT_MAXIMIZE_WINDOW
  * If defined, maximize the electron window on startup
* SVT_NO_DEVTOOLS
  * If defined, do not open the electron dev tools on startup
* SVT_LOG_LEVEL
  * If defined, the minimum logging level will be set to this value. Log messages are output to the terminal from which display-test-app was run. Example log levels include "debug", "error", "warning", etc - see Logger.ParseLogLevel() for the complete list.
* SVT_DISABLE_DIAGNOSTICS
  * By default, all debug-only code paths are enabled. These include assertions, console output, and potentially-expensive WebGL state checks like checkFramebufferStatus(). If this environment variable is defined (value does not matter), all of these debug-only code paths will be disabled. Note that this *only* affects assertions and console output produced within the rendering code.
* SVT_DISABLED_EXTENSIONS
  * If defined, a semicolon-separated list of names of WebGLExtensions to be disabled. See WebGLExtensionName for valid names (case-sensitive).
* SVT_OPTIMIZED_SURFACE_SHADERS
  * TEMPORARY: If defined, use optimized surface shaders when edge display is not needed.
* SVT_DISABLE_INSTANCING
  * If defined, instanced geometry will not be generated for tiles.
* SVT_DISABLE_ACTIVE_VOLUME_CULLING
  * If defined, geometry will not be culled against the active volume before drawing. Useful only for testing the feature gate and the performance differences.
* SVT_PRESERVE_SHADER_SOURCE_CODE
  * If defined, shader source code will be preserved as internal strings, useful for debugging purposes.
* SVT_OMIT_EDGES
  * If defined, when requesting tiles if edge display is off then the response will not include edges in the binary tile data.
* SVT_USE_PROJECT_EXTENTS
  * If defined, the range of a spatial tile tree will be based on the project extents rather than upon the model's range.
