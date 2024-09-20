# display-test-app Application

## About this Application

The application contained within this directory provides a test environment for developers working on the frontend functionality of iTwin.js. It is `not` intended to serve as an example or template for the design of "real" iTwin.js applications.

* package.json
  * Provides the npm start script for the application
  * Identifies the overall dependencies (including union of backend, frontend, and other core dependencies)
* public/
  * Static HTML to be loaded into a canvas via Electron
  * CSS formatting
  * Assets (images, icons, fonts)
* frontend/
  * The main application body of code that runs on initialization of the Electron app, as well setting up event handlers for parts of the UI
  * Extended API functionality build on top of the `@itwin/core-frontend` dependency
* backend/
  * Specifications for initializing the Electron application, as well as event handlers for Electron events.

## Getting Started

The application may be run as an Electron app, Mobile app or within a browser. The following steps outline the procedure for successfully building the application as part of a larger monorepo, and then starting the application via npm scripts.

* To get started, follow the instructions to setup the entire repository, located [here](../../README.md#Build\ Instructions).

* Before starting display-test-app, there are optional environment variables that may be set to be recognized by the application upon startup. For a full list, [see below](#environment-variables).

* To start the application in Electron, navigate to the root of display-test-app, and use the command:

```cmd
npm run start
```

* To start the application in a browser, run the following command, and then navigate to localhost:3000 in any supported browser (not Internet Explorer):

```cmd
npm run start:servers
```

## Using display-test-app

display-test-app provides no UI for selecting iModels from iModelHub - only a toolbar button to open an iModel from the local file system. However, if the iModel is a briefcase that was downloaded from iModelHub and is opened in read-write mode, it can push and pull changesets.
The `IMJS_STANDALONE_FILENAME` environment variable can be defined before startup to contain the absolute path to an iModel on disk; if so, it will be opened automatically at startup.

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

Debugging display-test-app can be accomplished using the following procedures to easily debug both the backend and frontend of the app.

In addition, the configuration allows setting breakpoints in any dependent package that lives within this monorepo (i.e. core-frontend or core-backend).

1. Make sure the backend is built `npm run build:backend`
1. Run `npm run start:webserver` (`npm run start:mobile` for Android and iOS)
    * Launches the vite dev server, providing hot-module reloading of the frontend
1. Launch the VSCode "display-test-app (electron)" or "display-test-app (chrome)" depending on which app type

A more advanced debug experience will give you more quick turn around time for both backend and frontend changes:

1. Initialize the backend build using `npm run build:backend -- --watch` in one terminal
    * The `--watch` command allows the Typescript compiler watch all of the source files and any time they change will automatically re-run the compilation
    * One caveat is you will have to restart the debugger (#3) each time you make a change. Note this is different from the frontend experience that live reloads the browser with the updated code, the backend doesn't support that currently.
1. Run `npm run start:webserver` in a separate terminal (`nmp run start:mobile` for Android and iOS)
    * Note: if the webserver and backend are run in the same terminal it will be hard to parse the output and attribute it to each one. This is why we recommend two different terminals instead of a single script to handle both.
1. Launch the VSCode "display-test-app (electron)" or "display-test-app (chrome)" depending on which app type

### What if a change is made in a dependent package in the monorepo?

The display-test-app is part of a monorepo which is setup to link all packages with symlinks so any time you make a change in a dependent package, and run that package's `npm run build` script, the output will automatically be picked up by the application. The steps to pick up that change is different depending on if it was a backend or frontend change.

For the frontend, if the page doesn't automatically refresh just refresh the page and the updated source will be available.

For the backend, restart the debugger config to pick up the changes.

## Dependencies

* Installed dependencies for display-test-app may be found in the generated node_modules directory. Since display-test-app is but a part of a larger monorepo, the dependencies here are provided as symlinks into a master node_modules directory managed by the build tool Rush.
* Any changes made to itwinjs-core files outside of this directory will not immediately be reflected in display-test-app. The entire monorepo must be rebuilt in order for changes to take effect.
* If dependencies have changed after pulling the most recent version of the repo, it is often necessary to do a clean reinstall of all dependencies in order to avoid build errors.

```cmd
rush install -c
```

## Environment Variables

You can use these environment variables to alter the default behavior of various aspects of the system. If you are running display-test-app on mobile, you can create a file named `.env.local.mobile` to hold mobile versions of the OIDC environment variables, while having Electron versions of the same variables in a file named `.env.local`.

* IMJS_STANDALONE_FILENAME
  * Absolute path to an iModel to be opened on start-up.
* IMJS_STANDALONE_FILEPATH (browser only)
  * Allows display-test-app running in the browser to assume a common base path for ALL local iModels. This enables the use of a file open dialog. Within that dialog you must navigate to the exact path and select a file residing inside that directory - not in any subdirectory thereof.
* IMJS_STANDALONE_VIEWNAME
  * The name of a view to open by default within an iModel.
* IMJS_STANDALONE_SIGNIN
  * If defined (value does not matter), the user will be required to sign in at startup. This enables access to content stored on the reality data service. As a side effect, you may observe a harmless "failed to fetch" dialog on startup, which can be safely dismissed.
* IMJS_STARTUP_MACRO
  * If defined, run macro from specified path. If the file path contains no periods, a .txt extension will be appended.
* IMJS_NO_MAXIMIZE_WINDOW
  * If defined, don't maximize the electron window on startup
* IMJS_NO_DEV_TOOLS
  * If defined, do not open the electron dev tools on startup
* IMJS_LOG_LEVEL
  * If defined, the minimum logging level will be set to this value. Log messages are output to the terminal from which display-test-app was run. Example log levels include "debug", "error", "warning", etc - see Logger.ParseLogLevel() for the complete list.
* IMJS_DISABLE_DIAGNOSTICS
  * By default, all debug-only code paths are enabled. These include assertions, console output, and potentially-expensive WebGL state checks like checkFramebufferStatus(). If this environment variable is defined (value does not matter), all of these debug-only code paths will be disabled. Note that this *only* affects assertions and console output produced within the rendering code.
* IMJS_DISABLED_EXTENSIONS
  * If defined, a semicolon-separated list of names of WebGLExtensions to be disabled. See WebGLExtensionName for valid names (case-sensitive).
* IMJS_DISABLE_INSTANCING
  * If defined, instanced geometry will not be generated for tiles. See TileAdmin.enableInstancing.
* IMJS_DISABLE_INDEXED_EDGES
  * If defined, indexed edges will not be produced. See TileAdmin.enableIndexedEdges.
* IMJS_NO_IMPROVED_ELISION
  * If defined, disables more accurate empty tile elision on backend.
* IMJS_IGNORE_AREA_PATTERNS
  * If defined, area pattern geometry will be omitted from tiles.
* IMJS_DISABLE_MAGNIFICATION
  * If defined, tiles will always be subdivided (size multipliers will never be applied).
* IMJS_PRESERVE_SHADER_SOURCE_CODE
  * If defined, shader source code will be preserved as internal strings, useful for debugging purposes.
* IMJS_TILETREE_EXPIRATION_SECONDS
  * If defined, the number of seconds after a TileTree has been most recently drawn before purging it.
* IMJS_TILE_EXPIRATION_SECONDS
  * If defined, the number of seconds after a Tile has been most recently used before pruning it.
* IMJS_DISABLE_LOG_Z
  * If defined, the logarithmic depth buffer will not be used.
* IMJS_DISABLE_DPI_AWARE_VIEWPORTS
  * If defined, do not respect the DPI of the system when rendering viewports.
* IMJS_DEVICE_PIXEL_RATIO_OVERRIDE
  * If defined, the pixel ratio used instead of the system's actual device pixel ratio.
* IMJS_DPI_LOD
  * If defined, account for the device DPI when computing level of detail for tiles and decoration graphics.
* IMJS_DISABLE_EDGE_DISPLAY
  * If defined, do not allow visible or hidden edges to be displayed, and also do not create any UI related to them.
* IMJS_USE_WEBGL2
  * Unless set to "0" or "false", the system will attempt to create a WebGL2 context before possibly falling back to WebGL1.
* IMJS_DISABLE_UNIFORM_ERRORS
  * If defined, do not throw an error for missing shader uniforms, and call Logger instead.
* IMJS_MAX_TILES_TO_SKIP
  * The number of levels of iModel tile trees to skip before loading graphics.
* IMJS_DEBUG_SHADERS
  * If defined, and the WEBGL_debug_shaders extension is supported, collect debug info during shader compilation. See the `dta output shaders` key-in.
* IMJS_WINDOW_SIZE
  * If defined, a comma-separated startup size for the electron application window as `width,height`.
* IMJS_ALWAYS_LOAD_EDGES
  * If defined, when requesting tile content, edges will always be requested regardless of view settings.
* IMJS_SUBDIVIDE_INCOMPLETE
  * If defined, TileAdmin.Props.alwaysSubdivideIncompleteTiles will be initialized to `true`.
* IMJS_MIN_SPATIAL_TOLERANCE
  * See TileAdmin.Props.minimumSpatialTolerance.
* IMJS_NO_EXTERNAL_TEXTURES
  * If defined, the backend will embed all texture image data directly in the tiles.
* IMJS_NO_FRONTEND_SCHEDULE_SCRIPTS
  * If defined, a schedule script applied to a display style is required to be hosted on a persistent RenderTimeline or DisplayStyle element.
* IMJS_ITWIN_ID.
  * GuidString of the Context Id (aka project id) to use to query Reality Data - use by Spatial Classification (e.g. "fb1696c8-c074-4c76-a539-a5546e048cc6").
  For IMJS_ITWIN_ID to work you should be in signin mode (IMJS_STANDALONE_SIGNIN=true).
  * Also used as the iTwin ID (aka project ID) for the given iModel if IMJS_IMODEL_ID is defined.
* IMJS_MAPBOX_KEY
  * If defined, sets the MapBox key for the `MapLayerOptions` as an "access_token".
* IMJS_BING_MAPS_KEY
  * If defined, sets a Bing Maps key within the `MapLayerOptions` as a "key" type.
* IMJS_CESIUM_ION_KEY
  * If defined, the API key supplying access to Cesium ION assets.
* IMJS_IMODEL_ID
  * If defined, the GuidString of the iModel to fetch from the iModel Hub and open.
* IMJS_URL_PREFIX
  * If defined, the URL prefix to use when accessing the iModel hub (eg "qa-").
* IMJS_OIDC_CLIENT_ID
  * If defined, the client ID to use for OIDC auth.
* IMJS_OIDC_SCOPE
  * If defined, the scope to be used for OIDC auth.
* IMJS_OIDC_REDIRECT_URI
  * If defined, the redirect URI to be used for OIDC auth.
    * NOTE: as long as IMJS_OIDC_HEADLESS is not defined, OIDC auth will default to using "http://localhost:3000/signin-callback" for this.
* IMJS_OIDC_CLIENT_SECRET
  * If defined in iOS, the client secret to be used for OIDC auth.
* IMJS_BRIEFCASE_CACHE_LOCATION
  * If defined, the full path to the directory in which to store cached briefcases.
* IMJS_IGNORE_CACHE
  * If defined, causes a locally cached copy of a a remote iModel to be deleted, forcing the iModel to always be downloaded.
* IMJS_DEBUG_URL
  * If defined on mobile, the URL used to open the frontend. (This is used in conjunction with `npm run start:mobile` and is the URL to the debug web server running on the developer's computer.)
* IMJS_EXIT_AFTER_MODEL_OPENED
  * If defined on iOS, the app will exit after successfully opening an iModel. This is used for automated testing with the iOS Simulator.
* IMJS_NO_ELECTRON_AUTH
  * If defined, the authorization client will not be initialized for the electron app, to work around a current bug that causes it to produce constant exceptions when attempting to obtain an access token.
* IMJS_FRONTEND_TILES_URL_TEMPLATE
  * If defined, specifies the url for @itwin/frontend-tiles to obtain tile trees for spatial views, served over localhost.
  * The string can include special tokens: `{iModel.key}`, `{iModel.filename}`, and `{iModel.extension}`.
  * These will get replaced by the value of iModel.key, just the filename of that (no path or extension), or just the extension (including .), correspondingly.
    * e.g.: <http://localhost:8080{iModel.key}-tiles/3dft/> or <http://localhost:8080/MshX/{iModel.filename}{iModel.extension}/>
  * Note that the contents of iModel.key will be different on different OSes.
* IMJS_GPU_MEMORY_LIMIT
  * If defined, specifies the GpuMemoryLimit with which to initialize TileAdmin (none, relaxed, default, aggressive; or a specific number of bytes).
* IMJS_NO_IMDL_WORKER
  * If defined, decoding of iMdl content is performed in the main thread instead of in a web worker. This makes debugging easier.

## Key-ins

display-test-app has access to all key-ins defined in the `@itwin/core-frontend` and `@itwin/frontend-devtools` packages. It also provides the following additional key-ins. The windowId of a viewport is an integer shown inside brackets in the viewport's title bar.

* `win resize` width height *windowId* - resize the content area of the specified of focused window to specified width and height.
* `win focus` windowId - give focus to the specified window.
* `win max` *windowId* - maximize the specified or focused window.
* `win dock` dock *windowId* - dock the specified or focused window. `dock` is a 1- or 2-character combination of the characters `t`, `l`, `r`, and `b`. e.g., to dock the focused window into the bottom-left corner, execute `win dock bl`.
* `win restore` *windowId* - restore (un-dock) the specified or focused window.
* `win close` *windowId* - close the specified or focused window.
* `vp clone` *viewportId* - create a new viewport looking at the same view as the specified or currently-selected viewport.
* `dta gltf` - load a glTF asset from and display it at the center of the project extents in the currently-selected viewport. If no URL is provided, a file picker allows selection of an asset from the local file system; in this case the asset must be fully self-contained (no references to other files). Optional arguments:
  * `u=assetUrl` - URL for the asset to load.
  * `i=numInstances` - the number of instances (at least 1) of the asset to render. If more than one, each will be drawn with a random translation roughly within the project extents.
  * `f=0|1` - if true, force multiple instances to render without instancing, chiefly for performance comparison purposes.
  * `s=0|1` - if true, apply a random scale to each instance.
  * `r=0|1` - if true, apply a random rotation to each instance.
  * `c=0|1` if true, apply a random color to each instance.
* `dta text` *command* *args* - an extremely basic text editing system that allows you to build up a TextAnnotation to be displayed as a decoration graphic in the current viewport. Start it using `dta text init <categoryId>`. Then use commands like `dta text fraction "numerator" "denominator"`, `dta text height <height>`, `dta text color <color>`, etc to build up the annotation. Use `dta text clear` to delete the decoration and reset all state to defaults. See TextDecoration.ts for the full set of commands.
* `dta version compare` - emulate version comparison.
* `dta save image` - capture the contents of the selected viewport as a PNG image. By default, opens a new window to display the image. Accepts any of the following arguments:
  * `w=width` - the desired width of the image in pixels. e.g. `w=640`.
  * `h=height` - the desired height of the image in pixels. e.g. `h=480`.
  * `d=dimensions` - the desired width and height of the image in pixels. The image will be square. e.g. `d=768`.
  * `c=0|1` - if `1`, instead of opening a new window to display the image, the image will be copied to the clipboard. NOTE: this probably doesn't work in Firefox.
* `dta record fps` *numFrames* - record average frames-per-second over the specified number of frames (default: 150) and output to status bar.
* `dta zoom selected` - zoom the selected viewport to the elements in the selection set. Optional arguments specify the margin or padding percent as follows:
  * `l=` `r=` `t=` `b=` followed by a number indicating the left, right, top, and/or bottom padding or margin percent.
  * `m=0|1` where zero indicates padding should be applied and 1 indicates margin should be applied.
  * `p=` followed by a number indicating the single value to use for top, left, right, and bottom.
* `dta incident markers` - toggle incident marker demo in the selected viewport.
* `dta path decoration` - toggle drawing a small path decoration in the selected viewport for testing purposes.
* `dta markup` - toggle markup on the selected viewport.
* `dta signin` - sign in to use Bentley services like iModelHub and reality data.
* `dta macro` - runs the macro file specified in the argument.  If file extension not specified, .txt is assumed.  Each line in the file is executed as a keyin command and run sequentially.
* `dta output shaders` - output debug information for compiled shaders. Requires IMJS_DEBUG_SHADERS to have been set. Accepts 0-2 arguments:
  * `c`: compile all shaders – compiles all shaders before output, otherwise only shaders that have been compiled by the time it is run will output.
  * `d=output\directory\` - directory into which to put the output files.
  * filter string: a combination of the following characters to filter the output (e.g., `gu` outputs all used glsl shaders, both fragment and vertex):
    * `f` or `v`: output only fragment or vertex shaders, respectively.
    * `g` or `h`: output only glsl or hlsl code, respectively.
    * `u` or `n`: output only used or not-used shaders, respectively.
* `dta drawing aid points` - start tool for testing AccuSnap.
* `dta refresh tiles` *modelId* - reload tile trees for the specified model, or all models if no modelId is specified.
* `dta exit` - Shuts down the backend server and exits the app.
* `dta shutdown` - Closes all open viewports and iModels, invokes IModelApp.shutdown(), and finally breaks in the debugger (if debugger is open). Useful for diagnosing memory leaks.
* `dta shadow tiles` - Display in all but the selected viewport the tiles that are selected for generating the shadow map for the selected viewport. Updates each time the shadow map is regenerated. Argument: "toggle", "on", or "off"; defaults to "toggle" if not supplied.
* `dta detach views` - If the selected viewport is displaying a sheet view, remove all view attachments from it.
* `dta attach view` - If the selected viewport is displaying a sheet view, add the specified view as a view attachment. Arguments:
  * `view=` (required): The Id of the persistent view, in hexadecimal format (e.g. `0x1ac`).
  * `category=`: The Id of the category onto which to place the attachment. Defaults to the first category found in the view's category selector.
  * `x=`, `y=`: The origin of the attachment on the sheet. Default to zero.
  * `rotation=`: Rotation of the attachment on the sheet in degrees. Defaults to zero.
  * `size=`: Ratio of the sheet's area that the attachment should occupy. Defaults to 1, making the attachment fill the entire sheet.
  * `priority=`: Display priority of the attachment in [-500,500]. Defaults to zero.
  * `image=`: Display as a raster image, even if view is orthographic. Perspective views always draw as raster images.
  * `background=`: Preserve background color when drawing as a raster image.
* `dta aspect skew decorator` *apply=0|1* - Toggle a decorator that draws a simple bspline curve based on the project extents, for testing the effect of aspect ratio skew on the curve stroke tolerance. Use in conjunction with `fdt aspect skew` to adjust the skew. If `apply` is 0, then the skew will have no effect on the curve's level of detail; otherwise a higher aspect ratio skew should produce higher-resolution curve graphics.
* `dta drape terrain` - Start a tool that demonstrates draping a linestring to either a reality mesh model or background map with terrain applied. The model is first selected and subsequent points define the linestring.
* `dta classify` - Start a tool that demonstrates how to use dynamically-created geometry to classify a reality model. First select the reality model to classify, then enter data points to place spheres as classifiers, and finally right-click to apply the classification. Options:
  * `radius=number` - sphere radius.
  * `volume=0|1` - 1 to produce a volume classifier, 0 for a planar classifier.
  * `inside=0|1|2|3|4` - SpatialClassifierInsideDisplay.
  * `outside=0|1|2` - SpatialClassifierOutsideDisplay.
* `dta clip mask` - Start a tool demonstrating how to use dynamically-created geometry to apply a planar clip mask to the background map or terrain. Left-click to place spheres, then right-click to apply their geometry as a mask. Options:
  * `radius=number` - radius of each sphere.
  * `invert=0|1` - if true, invert the mask so only regions of the map intersecting the mask are displayed.
  * `transparency=number` - transparency of the masked geometry in [0..1].
  * `priority=number` - the PlanarClipMaskPriority of the sphere geometry.
* `dta classifyclip selected` *inside* - Color code elements from the current selection set based on their containment with the current view clip. Inside - Green, Outside - Red, Overlap - Blue. Specify optional inside arg to only determine inside or outside, not overlap. Disable clip in the view settings to select elements outside clip, use clip tool panel EDIT button to redisplay clip decoration after processing selection. Use key-in again without a clip or selection set to clear the color override.
* `dta grid settings` - Change the grid settings for the selected viewport.
  * `spacing=number` Specify x and y grid reference line spacing in meters.
  * `ratio=number` Specify y spacing as current x * ratio.
  * `gridsPerRef=number` Specify number of grid lines to display per reference line.
  * `orientation=0|1|2|3|4` Value for GridOrientationType.
* `dta model transform` - Apply a display transform to all models currently displayed in the selected viewport. Origin is specified like `x=1 y=2 z=3`; pitch and roll as `p=45 r=90` in degrees; `s=0.5` specifies a uniform scale of 0.5. `b=1` indicates the transform should be pre-multiplied with the models' base transforms. Any argument can be omitted. Omitting all arguments clears the display transform. Snapping intentionally does not take the display transform into account.
* `dta model transform clear` - remove any display transforms previously applied to the currently-viewed models by `dta model transform`.
* `dta model transform disable` - remove all display transforms previously applied to any models by `dta model transform`.
* `dta model clip` - apply the view's current clip to the currently-viewed set of models as a ModelClipGroup, and remove the view clip. If the view has no clip defined, this removes the currently-viewed models from any ModelClipGroup to which they might belong.
* `dta viewport sync viewportIds` - Synchronize the contents of two or more viewports, specifying them by integer Id displayed in their title bars, or "all" to apply to all open viewports. Omit the Ids to disconnect previously synchronized viewports.
* `dta frustum sync *viewportId1* *viewportId2*` - Like `dta viewport sync but synchronizes only the frusta of the viewports.
* `dta gen tile *modelId=<modelId>* *contentId=<contentId>*` - Trigger a request to obtain tile content for the specified tile. This is chiefly useful for breaking in the debugger during that process to diagnose issues.
* `dta gen graphics` - Trigger a requestElementGraphics call to generate graphics for a single element. This is chiefly useful for breaking in the debugger during that process to diagnose issues.
  * `elementId=Id` The element for which to obtain graphics
  * `tolerance=number` The log10 of the desired chord tolerance in meters. Defaults to -2 (1 centimeter).
* `dta reality model settings` - Open a dialog in which settings controlling the display of reality models within the currently-selected viewport can be edited. Currently, it always edits the settings for the first reality model it can find. It produces an error if no reality models are found.
* `dta clip element geometry` - Starts a tool that clips the view based on the geometry of the selected element(s).
* `dta record tilesize [on|off|toggle]` - When turned on, begins recording the encoded size of every subsequently requested iMdl tile's content. When turned off, copies the tile sizes in CSV format to the clipboard. See TileSizeRecorder.ts for details. If no argument is supplied, it defaults to `toggle`.
* `dta imodel attach` - Toggles a secondary IModelConnection to be displayed in the active viewport. The first time it is invoked, it opens a file open dialog from which you can select the iModel. All of the 3d models in the secondary iModel will be displayed in the viewport. Invoke it again to remove the secondary iModel from the view.

## Editing

display-test-app supplies minimal features for editing the contents of an iModel, strictly for testing purposes. To use it:

* Set IMJS_READ_WRITE=1 in the environment.
* Open a briefcase or an editable standalone iModel.
* Use the key-ins below to make changes; typically:
  * `dta edit` to begin an editing scope;
  * key-ins to delete/move/insert elements and undo/redo those changes;
  * `dta edit` to end the editing scope.

Using an editing scope is optional, but outside of a scope, the viewport's graphics will not remain in sync with your changes. In the context of a scope, the graphics will update immediately to reflect your changes; when the scope ends, new tiles will be produced reflecting the sum of those changes.

### Editing key-ins

display-test-app has access to all key-ins defined in the `@itwin/editor-frontend` package. It also provides the following additional key-ins.

* `dta edit` - begin a new editing scope, or end the current editing scope. The title of the window or browser tab will update to reflect the current state: "[R/W]" indicating no current editing scope, or "[EDIT]" indicating an active editing scope.
* `dta place line string` - start placing a line string. Each data point defines another point in the string; a reset (right mouse button) finishes. The element is placed into the first spatial model and spatial category in the viewport's model and category selectors.
* `dta move element *elementId* *x* *y* *z*` - Move an element, given an element Id and an x y z offset (in world space, relative to its current). If Y and/or Z are not specified they will default to 0.
* `dta push` - push local changes to iModelHub. A description of the changes must be supplied. It should be enclosed in double quotes if it contains whitespace characters.
* `dta pull` - pull and merge changes from iModelHub into the local briefcase. You must be signed in.
* `dta create section drawing *drawingName*` - insert a spatial view matching the active viewport's current view and a section drawing referencing that view, then switch to a non-persistent drawing view to visualize the spatial view in a 2d context. Requires the camera to be turned off.

## Running in iOS

The steps to run the display test app in an iOS app:

1. Run `npm run build:ios`
2. Open `test-apps/display-test-app/ios/imodeljs-test-app/imodeljs-test-app.xcodeproj`
3. Start the XCode Project to an iPad
