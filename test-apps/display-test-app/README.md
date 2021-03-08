# display-test-app Application

## About this Application

The application contained within this directory provides a test environment for developers working on the frontend functionality of iTwin.js. It is **not** intended to serve as an example or template for the design of "real" iTwin.js applications.

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

Currently, display-test-app only supports opening snapshot iModels from the local disk. If you define the `SVT_STANDALONE_FILENAME` environment variable to contain the absolute path to an existing iModel file on your machine, then upon startup, a viewport displaying the contents of this iModel will be displayed. Otherwise, on startup the toolbar will have a button allowing you to select an iModel to open.

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
* Left-click cross in top-left corner: close the window.
* Left-drag triangle in top-right corner: resize the window
* Double-click title bar: undock the window if docked; otherwise maximize the window.
* Ctrl-h/l/j/k: dock to the left/right/bottom/top edge respectively. Behavior is similar to pressing the Windows key plus an array key in Windows.
  * If the window is already docked, these shortcuts respect the current dock state. e.g., `ctrl-h` on a window docked to the bottom will cause the window to dock to the bottom-left.
* Ctrl-[/]: focus previous/next window.
* Ctrl-\: clone the focused viewport.
* Ctrl-|: close the focused window.
* Ctrl-p: toggle pinned state of the focused window. A pinned window renders on top of other windows even when it is not focused.  Pinned windows will show a right red tringle in the right right corner of the window.
* Ctrl-m: maximize the focused window.
* Ctrl-i: restore the focused window.

The currently-selected viewport is indicated by a gold border. The toolbar always operates on the selected viewport, and many key-ins operate on the selected viewport if no explicit viewport ID argument is supplied.

The notifications window can be focused by pressing Ctrl-n. Pressing Ctrl-n again will restore focus to the previously-focused window.

## Debugging

Debugging display-test-app can be accomplished using the following procedures, depending on which packages of iTwin.js you would like to step through:

* frontend
  * The frontend and common iTwin.js core packages may be debugged simply by starting the addon using the steps listed in [Getting Started](#Getting\ Started), and then setting breakpoints within the Chrome developer tools window which will open automatically.
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
* SVT_STANDALONE_FILENAME
  * Absolute path to an iModel to be opened on start-up.
* SVT_STANDALONE_FILEPATH (browser only)
  * Allows SVT running in the browser to assume a common base path for ALL local standalone iModels. This enables the use of a file open dialog. Within that dialog you must navigate to the exact path and select a file residing inside that directory - not in any subdirectory thereof.
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
* SVT_NO_IMPROVED_ELISION
  * If defined, disables more accurate empty tile elision on backend.
* SVT_IGNORE_AREA_PATTERNS
  * If defined, area pattern geometry will be omitted from tiles.
* SVT_DISABLE_MAGNIFICATION
  * If defined, tiles will always be subdivided (size multipliers will never be applied).
* SVT_PRESERVE_SHADER_SOURCE_CODE
  * If defined, shader source code will be preserved as internal strings, useful for debugging purposes.
* SVT_TILETREE_EXPIRATION_SECONDS
  * If defined, the number of seconds after a TileTree has been most recently drawn before purging it.
* SVT_TILE_EXPIRATION_SECONDS
  * If defined, the number of seconds after a Tile has been most recently used before pruning it.
* SVT_DISABLE_LOG_Z
  * If defined, the logarithmic depth buffer will not be used.
* SVT_FAKE_CLOUD_STORAGE
  * If defined, cloud storage tile caching will be simulated. Cached tiles will be stored in ./lib/backend/tiles/. They will be removed by a `rush clean` or `npm run clean`.
    * NOTE: This currently only works when running display-test-app in a browser.
* SVT_ENABLE_MAP_TEXTURE_FILTER
  * If defined, the anisotropic filtering will be used for (planar) map tiles.
* SVT_DISABLE_MAP_DRAPE_TEXTURE_FILTER
  * If defined, the anisotropic filtering will be disabled for map tiles draped on terrain.
* SVT_DISABLE_DPI_AWARE_VIEWPORTS
  * If defined, do not respect the DPI of the system when rendering viewports.
* SVT_DEVICE_PIXEL_RATIO_OVERRIDE
  * If defined, the pixel ratio used instead of the system's actual device pixel ratio.
* SVT_DPI_LOD
  * If defined, account for the device DPI when computing level of detail for tiles and decoration graphics.
* SVT_DISABLE_EDGE_DISPLAY
  * If defined, do not allow visible or hidden edges to be displayed, and also do not create any UI related to them.
* SVT_USE_WEBGL2
  * Unless set to "0" or "false", the system will attempt to create a WebGL2 context before possibly falling back to WebGL1.
* SVT_MAX_TILES_TO_SKIP
  * The number of levels of iModel tile trees to skip before loading graphics.
* SVT_DISABLE_IDLE_WORK
  * If defined, do not try to perform idle work (precompiling shader) when there are no viewports.
* SVT_DEBUG_SHADERS
  * If defined, and the WEBGL_debug_shaders extension is supported, collect debug info during shader compilation. See the `dta output shaders` key-in.
* SVT_WINDOW_SIZE
  * If defined, a comma-separated startup size for the electron application window as `width,height`.
* SVT_ALWAYS_LOAD_EDGES
  * If defined, when requesting tile content, edges will always be requested regardless of view settings.
* SVT_SUBDIVIDE_INCOMPLETE
  * If defined, TileAdmin.Props.alwaysSubdivideIncompleteTiles will be initialized to `true`.
* SVT_MIN_SPATIAL_TOLERANCE
  * See TileAdmin.Props.minimumSpatialTolerance.
* SVT_NO_EXTERNAL_TEXTURES
  * If defined, the backend will embed all texture image data directly in the tiles.

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
* **dta record fps** *numFrames* - record average frames-per-second over the specified number of frames (default: 150) and output to status bar.
* **dta zoom selected** - zoom the selected viewport to the elements in the selection set.
* **dta incident markers** - toggle incident marker demo in the selected viewport.
* **dta path decoration** - toggle drawing a small path decoration in the selected viewport for testing purposes.
* **dta markup** - toggle markup on the selected viewport.
* **dta output shaders** - output debug information for compiled shaders. Requires SVT_DEBUG_SHADERS to have been set. Accepts 0-2 arguments:
  * `d=output\directory\` - directory into which to put the output files.
  * filter string: a combination of the following characters to filter the output (e.g., `gu` outputs all used glsl shaders, both fragment and vertex):
    * `f` or `v`: output only fragment or vertex shaders, respectively.
    * `g` or `h`: output only glsl or hlsl code, respectively.
    * `u` or `n`: output only used or not-used shaders, respectively.
* **dta drawing aid points** - start tool for testing AccuSnap.
* **dta refresh tiles** *modelId* - reload tile trees for the specified model, or all models if no modelId is specified.
* **dta shutdown** - Closes all open viewports and iModels, invokes IModelApp.shutdown(), and finally breaks in the debugger (if debugger is open). Useful for diagnosing memory leaks.
* **dta shadow tiles** - Display in all but the selected viewport the tiles that are selected for generating the shadow map for the selected viewport. Updates each time the shadow map is regenerated. Argument: "toggle", "on", or "off"; defaults to "toggle" if not supplied.
* **dta detach views** - If the selected viewport is displaying a sheet view, remove all view attachments from it.
* **dta attach view** - If the selected viewport is displaying a sheet view, add the specified view as a view attachment. Arguments:
  * `view=` (required): The Id of the persistent view, in hexadecimal format (e.g. `0x1ac`).
  * `category=`: The Id of the category onto which to place the attachment. Defaults to the first category found in the view's category selector.
  * `x=`, `y=`: The origin of the attachment on the sheet. Default to zero.
  * `rotation=`: Rotation of the attachment on the sheet in degrees. Defaults to zero.
  * `size=`: Ratio of the sheet's area that the attachment should occupy. Defaults to 1, making the attachment fill the entire sheet.
  * `priority=`: Display priority of the attachment in [-500,500]. Defaults to zero.
  * `image=`: Display as a raster image, even if view is orthographic. Perspective views always draw as raster images.
  * `background=`: Preserve background color when drawing as a raster image.
* **dta aspect skew decorator** *apply=0|1* - Toggle a decorator that draws a simple bspline curve based on the project extents, for testing the effect of aspect ratio skew on the curve stroke tolerance. Use in conjunction with `fdt aspect skew` to adjust the skew. If `apply` is 0, then the skew will have no effect on the curve's level of detail; otherwise a higher aspect ratio skew should produce higher-resolution curve graphics.
* **dta classifyclip selected** *inside* - Color code elements from the current selection set based on their containment with the current view clip. Inside - Green, Outside - Red, Overlap - Blue. Specify optional inside arg to only determine inside or outside, not overlap. Disable clip in the view settings to select elements outside clip, use clip tool panel EDIT button to redisplay clip decoration after processing selection. Use key-in again without a clip or selection set to clear the color override.
* **dta model transform** - Apply a display transform to all models currently displayed in the selected viewport. Origin is specified like `x=1 y=2 z=3`; pitch and roll as `p=45 r=90` in degrees. Any argument can be omitted. Omitting all arguments clears the display transform. Snapping intentionally does not take the display transform into account.

## Editing

display-test-app supplies minimal features for editing the contents of an iModel, strictly for testing purposes. To use it:
* Set SVT_READ_WRITE=1 in the environment.
* Open an editable standalone iModel.
* Use the key-ins below to make changes; typically:
  * `dta edit` to begin an interactive session;
  * key-ins to delete/move/insert elements and undo/redo those changes;
  * `dta edit` to end the interactive session.

Using an editing session is optional, but outside of a session, the viewport's graphics will not remain in sync with your changes. In the context of a session, the graphics will update immediately to reflect your changes; when the session ends, new tiles will be produced reflecting the sum of those changes.

### Editing key-ins

* `dta edit` - begin a new editing session, or end the current editing session. The title of the window or browser tab will update to reflect the current state: "[R/W]" indicating no current editing session, or "[EDIT]" indicating an active editing session.
* `dta delete elements` - delete all elements currently in the selection set.
* `dta move elements` - start moving elements. If no elements are currently in the selection set, you will be prompted to select one. First data point defines the start point; second defines the end point and moves the element(s) by the delta between the two points.
* `dta place line string` - start placing a line string. Each data point defines another point in the string; a reset (right mouse button) finishes. The element is placed into the first spatial model and spatial category in the viewport's model and category selectors.
* `dta undo` - undo the most recent change.
* `dta redo` - redo the most recently-undone change.
