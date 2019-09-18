# display-test-app Application

## About this Application

The application contained within this directory provides a test environment for developers working on the frontend functionality of iModel.js. It is **not** intended to serve as an example or template for the design of "real" iModel.js applications.

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

The application may be run as an Electron app, Mobile app or within a browser. The following steps outline the procedure for successfully building the application as part of a larger monorepo, and then starting the application via npm scripts.

* To get started, follow the instructions to setup the entire repository, located [here](../../README.md#Build\ Instructions).

* Before starting display-test-app, there are optional environment variables that may be set to be recognized by the application upon startup. For a full list, see below.

* To start the application in Electron, navigate to the root of display-test-app, and use the command:

```cmd
npm run start
```

* To start the application in a browser, run the following command, and then navigate to localhost:3000 in any supported browser (not Internet Explorer):

```cmd
npm run start:servers
```

## Using display-test-app

Currently, display-test-app only supports opening snapshot iModels from the local disk. You must define the `SVT_STANDALONE_FILENAME` environment variable to contain the absolute path to an existing iModel file on your machine. Upon startup, a viewport displaying the contents of this iModel will be displayed. Thereafter, other iModels can be opened within the same session.

display-test-app's UI consists of:
* A toolbar containing tools for interacting with the currently-selected viewport.
* A status bar at the top containing:
  * A key-in field into which key-in commands can be entered for execution.
  * A combo-box for changing the current snap mode.
  * A progress indicator showing progress of tile requests for all viewports.
* A large central surface on which any number of floating windows (including iModel viewports) can be positioned.
  * Within this surface, a window in which notifications are displayed.
* A status bar at the bottom in which prompts and error messages are displayed.

Much of display-test-app's functionality can be efficiently accessed via the key-in field. Press the backtick key to focus the key-in field. As you type, available key-in commands matching the input will be displayed. Press `Enter` to execute the key-in. See the list of key-ins below.

Viewports are displayed as floating windows. The currently-focused window is indicated by a bright title bar and border. Windows can be manipulated as follows:
* Left-drag title bar: move the window.
* Left-drag triangle in top-right corner: resize the window
* Double-click title bar: undock the window if docked; otherwise maximize the window.
* Ctrl-h/l/j/k: dock to the left/right/bottom/top edge respectively. Behavior is similar to pressing the Windows key plus an array key in Windows.
  * If the window is already docked, these shortcuts respect the current dock state. e.g., `ctrl-h` on a window docked to the bottom will cause the window to dock to the bottom-left.
* Ctrl-[/]: focus previous/next window.
* Ctrl-\: clone the focused viewport.
* Ctrl-|: close the focused window.
* Ctrl-p: toggle pinned state of the focused window. A pinned window renders on top of other windows even when it is not focused.

The currently-selected viewport is indicated by a gold border. The toolbar always operates on the selected viewport, and many key-ins operate on the selected viewport if no explicit viewport ID argument is supplied.

The notifications window can be focused by pressing Ctrl-n. Pressing Ctrl-n again will restore focus to the previously-focused window.

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

```cmd
rush install -c
```

## Environment Variables

You can use these environment variables to alter the default behavior of various aspects of the system. If you are running display-test-app on mobile, you will need to edit display-test-app's entry in apps.config.json. In the "env" section, add an entry corresponding to the desired property from the SVTConfiguration interface. The "env" section contains a JSON version of an SVTConfiguration object.
* SVT_STANDALONE_FILENAME (required)
  * Absoluate path to an iModel to be opened on start-up.
* SVT_STANDALONE_FILEPATH
  * Allows SVT running in the browser to assume a common base path for ALL local standalone iModels (browser only).
* SVT_STANDALONE_VIEWNAME
  * The name of a view to open by default within an iModel.
* SVT_STANDALONE_SIGNIN
  * If defined (value does not matter), the user will be required to sign in. This enables access to content stored on the reality data service. As a side effect, you may observe a harmless "failed to fetch" dialog on startup, which can be safely dismissed.
* SVT_NO_MAXIMIZE_WINDOW
  * If defined, don't maximize the electron window on startup
* SVT_NO_DEV_TOOLS
  * If defined, do not open the electron dev tools on startup
* SVT_LOG_LEVEL
  * If defined, the minimum logging level will be set to this value. Log messages are output to the terminal from which display-test-app was run. Example log levels include "debug", "error", "warning", etc - see Logger.ParseLogLevel() for the complete list.
* SVT_DISABLE_DIAGNOSTICS
  * By default, all debug-only code paths are enabled. These include assertions, console output, and potentially-expensive WebGL state checks like checkFramebufferStatus(). If this environment variable is defined (value does not matter), all of these debug-only code paths will be disabled. Note that this *only* affects assertions and console output produced within the rendering code.
* SVT_DISABLED_EXTENSIONS
  * If defined, a semicolon-separated list of names of WebGLExtensions to be disabled. See WebGLExtensionName for valid names (case-sensitive).
* SVT_DISABLE_INSTANCING
  * If defined, instanced geometry will not be generated for tiles.
* SVT_DISABLE_MAGNIFICATION
  * If defined, tiles will always be subdivided (size multipliers will never be applied).
* SVT_PRESERVE_SHADER_SOURCE_CODE
  * If defined, shader source code will be preserved as internal strings, useful for debugging purposes.
* SVT_TILETREE_EXPIRATION_SECONDS
  * If defined, the number of seconds after a TileTree has been most recently drawn before purging it.
* SVT_DISABLE_LOG_Z
  * If defined, the logarithmic depth buffer will not be used.
* SVT_DISABLE_DIRECT_SCREEN_RENDERING
  * If defined, we will not render webgl content directly to the screen when only 1 on-screen viewport is open.
* SVT_FAKE_CLOUD_STORAGE
  * If defined, cloud storage tile caching will be simulated. Cached tiles will be stored in ./lib/webresources/tiles/.
    * NOTE: This currently only works when running display-test-app in a browser.

## Key-ins

display-test-app has access to all key-ins defined in the imodeljs-frontend and frontend-devtools packages. It also provides the following additional key-ins. The windowId of a viewport is an integer shown inside brackets in the viewport's title bar.
* **win resize** width height *windowId* - resize the content area of the specified of focused window to specified width and height.
* **win focus** windowId - give focus to the specified window.
* **win max** *windowId* - maximize the specified or focused window.
* **win dock** dock *windowId* - dock the specified or focused window. `dock` is a 1- or 2-character combination of the characters `t`, `l`, `r`, and `b`. e.g., to dock the focused window into the bottom-left corner, execute `win dock bl`.
* **win restore** *windowId* - restore (un-dock) the specified or focused window.
* **win close** *windowId* - close the specified or focused window.
* **vp clone** *viewportId* - create a new viewport looking at the same view as the specified or currently-selected viewport.
* **dta version compare** - emulate version comparison.
* **dta save image** - open a new window containing a snapshot of the contents of the selected viewport.
* **dta zoom selected** - zoom the selected viewport to the elements in the selection set.
* **dta incident markers** - toggle incident marker demo in the selected viewport.
* **dta markup** - toggle markup on the selected viewport.
* **dta drawing aid points** - start tool for testing AccuSnap.
* **dta refresh tiles** *modelId* - reload tile trees for the specified model, or all models if no modelId is specified.
