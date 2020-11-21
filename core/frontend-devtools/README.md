# @bentley/frontend-devtools

Copyright © Bentley Systems, Incorporated. All rights reserved.

## Description

The __@bentley/frontend-devtools__ package contains various tools and widgets designed to help track information and diagnose issues related to the iModel.js front-end display system. It is intended chiefly for use by developers.

Because this is a developer-only package, its functionality is not expected to ever be promoted from "beta" to "public".

## Contents

* /src/FrontendDevTools.ts - entry point for initializing the package.
* /src/ui/ - rudimentary basic html controls used to build the widgets.
* /src/tools/ - a collection of immediate-mode and interactive-mode tools. All of the tools' key-in strings begin with "fdt" (as in, "Front-end Dev Tools").
* /src/widgets/ - widgets that wrap some of the package's functionality into embeddable UI controls, including:
  * `KeyinField` - allows any tool to be executed by typing in its keyin string (with autocompletion).
  * `FpsTracker` - displays the average frames-per-second.
  * `TileStatisticsTracker` - displays the state of tile requests in the system.
  * `MemoryTracker` - displays statistics about GPU memory allocated by the display system.
  * `GpuProfiler` - displays GPU timing queries and allows recording for viewing in chrome://tracing. See https://aras-p.info/blog/2017/01/23/Chrome-Tracing-as-Profiler-Frontend/ for more information.
  * `DiagnosticsPanel` - combines all of the above widgets into a single panel.

## Usage

The package must be initialized before use. This can be done when your application starts up, or deferred until first use of the package. The packages' tools will not be registered until the package is initialized.

Example of initializing at start-up:

```ts
  await IModelApp.startup();
  await FrontendDevTools.initialize();
```

An easy way to use this package is to instantiate a `DiagnosticsPanel`, supplying a `Viewport` for which the panel will supply diagnostics and tools.
You can then integrate the panel into your UI by appending its `element` HTMLElement to your DOM.

Alternatively, you can embed any configuration of the widgets into your DOM as you like.

Even if you use none of the widgets, initializing the package will make all of its tools available for use, ready to be associated with your own UI entry points or to be executed via key-in. The set of available key-ins can be found in /public/locales/en/FrontendDevTools.json.

## Key-ins

The following key-ins are delivered with this package. Each begins with the prefix `fdt`, short for "Front-end Dev Tools". Use `FrontendDevTools.initialize` to register them for use in your application.

### Toggle key-ins

The key-ins below enable, disable, or toggle a specific feature. They take at most one argument (case-insensitive):
  * "on": Display the decoration.
  * "off": Stop displaying the decoration.
  * "toggle" or no arguments: Invert the current state.

* `fdt project extents` - Toggles display of a decoration illustrating the iModel's project extents.
* `fdt freeze scene` - Toggles scene freeze for the active viewport. While scene freeze is enabled, the same set of tiles will continue to be displayed until the scene is unfrozen - no new tiles will be loaded. Useful for zooming in or out to inspect geometry inside specific tiles.
* `fdt frustum selected` - Toggles a decoration representing the current frustum of the selected viewport. The decoration is displayed in any *other* open viewports - so if no other viewports are open, this key-in has no effect.
* `fdt shadow frustum` - Like `fdt frustum selected`, but visualizes the frustum used to select tiles for the shadow map (when shadows are enabled).
* `fdt frustum snapshot` - Toggles a decoration representing the current frustum of the active viewport. The decoration remains displayed until it is toggled back off. `fdt frustum selected` is much more useful, but requires at least two open viewports.  Including `fdt snapshot preload` will also display the preload frustum decoration.
* `fdt tooltips` - Toggles debugging tooltips for element locate. When enabled, hovering over an element will display a tooltip containing information like element ID, subcategory ID, and model ID.
* `fdt metric` - Toggles use of metric quantity formatting, e.g. as used to format output from the measure tools. Turning metric "off" switches to use of imperial units.
* `fdt fadeout` - Toggles "fade-out" transparency mode for the selected viewport.
* `fdt tile requests` - When enabled, displays in each viewport the bounding boxes of all tiles currently requested for loading by the viewport that was selected at the time the key-in was executed. Green boxes indicate pending requests; red indicate requests being actively processed.
* `fdt 3dmanip` - Change the `allow3dManipulations` flag for the 3d view associated with the active viewport.
* `fdt tiletree bounds` - When enabled, draws bounding boxes representing the volume of each tile tree displayed in the active viewport.
* `fdt toggle readpixels` - Toggles "read pixels" mode on the active viewport. In this mode, geometry is rendered to the screen as if it was being rendered off-screen for element locate purposes.
* `fdt dpi lod` - Toggles whether device pixel ratio should be taken into account when computing LOD for tiles and decoration graphics.
* `fdt attachments` - Toggles display of view attachments in the sheet view associated with the active viewport.
* `fdt attachment bounds` - Toggles display of bounding boxes around each view attachment in the active viewport.
* `fdt toggle drapefrustum` - Toggles display of frustum that is used to drape classifiers and background map.
* `fdt toggle reality preload` - Toggles the display of preloaded reality tile bounding boxes.
* `fdt toggle reality freeze`  - Toggles the freezing of reality tile loading, when the reality tiles are frozen new reality tiles are not downloaded or purged.
* `fdt toggle reality logging` - Toggle the logging of reality tile loading and selection diagnostics to the console.
* `fdt toggle reality bounds` - Toggle the display of bounding boxes for reality tiles.
* `fdt set building display` Toggle the display of the worldwide OpenStreetMap worldwide buildingslayer by attaching or displaying as a reality model in the current viewport.  The OSM buildings are aggregated and supplied from Cesium Ion <https://cesium.com/content/cesium-osm-buildings/>. The first argument is required on|off - the second optional argument is a value for transparency between 0 and 1.
### Other key-ins

* `fdt save view` - Copies to the clipboard a JSON representation of the view currently displayed in the active viewport.
* `fdt apply view` - Accepts an unquoted JSON representation of a view, e.g., as obtained from `fdt save view`, and applies that view to the active viewport.
* `fdt apply viewid` - Accepts the Id of a persistent ViewDefinition in hexadecimal format and applies that view to the active viewport.
* `fdt save rendering style` - Outputs selected aspects of the active viewport's display style as JSON. See `DisplayStyleSettings.toOverrides`. Each argument is of the format "option=value" where `value` is 0 for false or 1 for true. All arguments default to false.
  * `all`: include all settings.
  * `imodel`: include iModel-specific settings.
  * `project`: include project-specific settings.
  * `map`: include background map settings.
  * `drawingaids`: include drawing aid decoration settings.
  * `copy`: copy result to system clipboard.
  * `quote`: format the result so it can be directly parsed by `fdt apply rendering style` as a single quoted string argument.
* `fdt apply rendering style` - Given a rendering style as a JSON string (see `fdt save rendering style`), applies it to the active viewport's display style. See `DisplayStyleSettings.applyOverrides`. Takes a single required argument: the JSON string.
* `fdt change viewflags` - Changes any number of ViewFlags for the active viewport. Each argument is of the format "flag=value". For boolean flags, the value is `0` for `false` or `1` for `true`. Flag names are case-insensitive.
  * Boolean flags: "dimensions", "patterns", "weights", "styles", "transparency", "fill", "textures", "materials", "acsTriad", "grid", "visibleEdges", "hiddenEdges", "lighting", "shadows", "clipVolume", "constructions", "monochrome", "backgroundMap", "ambientOcclusion", "forceSurfaceDiscard"
  * "renderMode": 0 = wireframe, 3 = hidden line, 4 = solid fill, 6 = smooth shade (numeric values of RenderMode enum).
* `fdt inspect element` - Creates a readable text summary of a geometric element or geometry part. The keyin takes the following arguments (only the first character of each is checked), all of which are optional:
  * "id=elementId" where "elementId" is a hexadecimal element Id such as `0x12cb` - can also specify as a comma-separated list of any number of elementIds;
  * "symbology=0|1" where `1` indicates detailed symbology information should be included in the output;
  * "placement=0|1" where `1` indicates detailed geometric element placement should be included; and
  * "verbosity=0|1|2" controlling the verbosity of the output for each geometric primitive in the geometry stream. Higher values = more detailed information. Note `verbosity=2` can produce megabytes of data for certain types of geometric primitives like large meshes.
  * "refs=0|1" where `1` indicates that if the element is a geometry part, the output should include a list of all geometric elements which reference that geometry part. This is **extremely** inefficient and may take a very long time to process in iModels containing many geometric elements.
  * "modal=0|1" where `1` indicates the output should be displayed in a modal dialog.
  * "copy=0|1" where `1` indicates the output should be copied to the system clipboard.
* `fdt select elements` - given a list of element Ids separated by whitespace, replace the contents of the selection set with those Ids.
* `fdt toggle skybox` - If the active viewport is displaying a spatial view, toggles display of the skybox.
* `fdt emphasize selection` - Emphasizes all elements in the selection set, and de-emphasizes all other elements by making them semi-transparent and grey. If the selection set is empty, clear the effects of any previous use of this key-in. Accepts one of the following arguments:
  * "none": Don't override color, don't apply silhouette.
  * "color": Override color to white.
  * "emphasis": Apply silhouette for emphasis.
  * "both": Apply both color and silhouette.
* `fdt isolate selection` - Causes all elements except those currently in the selection set to stop drawing.
* `fdt clear isolate` - Reverse the effects of `fdt isolate selection`.
* `fdt toggle wiremesh` - Toggles "pseudo-wiremesh" display. This causes surfaces to be rendered using `GL_LINES` instead of `GL_TRIANGLES`. Useful for visualizing the triangles of a mesh - but not suitable for "real" wiremesh display.
* `fdt tile bounds` - Sets the type of bounding volume decorations that will be displayed for each tile displayed in the view. Accepts at most one argument; if none is specified, it defaults to "volume", unless tile bounds are already displayed, in which it toggles them back off.
  * "none": Don't display bounding volumes.
  * "volume": Bounding box representing the full range of each tile.
  * "content": Tighter bounding box representing the range of geometry contained within each tile.
  * "both": Both volume and content boxes.
  * "children": For each tile, draw a box around the volume of each of its child tiles, color-coded such that green indicates an empty child tile and blue a non-empty child tile.
  * "sphere": Bounding sphere representing the full range of each tile.
* `fdt time tile load` - Purges all tile trees from memory and reloads the contents of the selected viewport. Outputs to the notifications center the time elapsed once all tiles required for the view are loaded and displayed.
* `fdt hilite settings` - Modifies the hilite settings for the selected viewport. If no arguments are specified, it resets them to the defaults. Otherwise, each argument modifies an aspect of the current settings:
  * "r", "g", or "b": An integer in [0..255] specifying the red, green, or blue component of the hilite color.
  * "v", "h": The visible or hidden ratio in [0..1].
  * "s": The silhouette as an integer in [0..2] (see Hilite.Silhouette enum).
* `fdt emphasis settings` - Modifies the hilite settings used for emphasized elements in the selected viewport. If no arguments are specified, it does nothing. See `fdt hilite settings` for supported arguments.
* `fdt tilesize default` - Changes the default tile size modifier used by viewports that don't explicitly override it. Accepts a floating point number greater than zero.
* `fdt tilesize viewport` - Overrides the tile size modifier for the selected viewport (if a floating point number is supplied) or clears the override (if the string "reset" is supplied). The modifier must be greater than zero.
* `fdt webgl report compatibility` - Opens a modal dialog with information about the client's level of support for various features of the iModel.js display system.
* `fdt webgl lose context` - Force a webgl context loss.
* `fdt compile shaders` - Compile all un-compiled registered shader programs and report whether any errors occurred. Useful for testing/debugging platform-specific shader issues.
* `fdt animation interval` - Changes the `IModelApp.animationInterval` settings. Specify milliseconds in non-negative milliseconds; or anything not parseable as an integer to disable the interval callback entirely.
* `fdt visibility` - Controls whether instanced, un-instanced (batched), or all geometry is displayed in the active viewport. Accepts at most one argument; defaults to "all" if none is specified:
  * "instanced": Display only instanced geometry.
  * "batched": Display only un-instanced (batched) geometry.
  * "all": Display all geometry.
* `fdt aspect skew` - Change the aspect ratio skew of the active viewport. Accepts the floating point skew; defaults to 1.
* `fdt reality transition` Creates a rendering schedule to transition between reality model and BIM model display.
  * "x" - Wipe along X axis.
  * "y" - Wipe along Y axis.
  * "z' - wipe along Z axis.
  * "transparent" - Fade from reality model to BIM model.
* `fdt attach reality model` - Attach a "context" reality model to the currently selected viewport.
  * the URL for the reality model root JSON file.
* `fdt attach cesium asset ` - Attach a "context" reality model from Cesium ion.
  * the asset ID.
  * the authorization token.
* `fdt detach reality model` - Detach a (contextual) reality model.  First argument if supplied is the reality model index, if not supplied then the tool detaches all reality models.
* `fdt set reality model transparency` - Set the transparency for a (contextual) reality model.  The first argument is transparency in [0..1]. Second argument if supplied is the reality model index, if not supplied then the the tool applies to all reality models.
* `fdt set reality model locatable` - Set the whether a (contextual) reality model can be located.  The first argument must be `true`, `false`, `on` or `off`. Second argument if supplied is the reality model index, if not supplied then the the tool applies to all reality models.
* `fdt set reality model emphasized` - Set the whether a (contextual) reality model is emphasized. The first argument must be `true`, `false`, `on` or `off`. Second argument if supplied is the reality model index, if not supplied then the the tool applies to all reality models.
* `fdt set reality model color` - Set the reality model color.  The first three arguments are red, green and blue components in [0,255].  Second argument if supplied is the reality model index, if not supplied then the the tool applies to all reality models.
* `fdt clear reality model overrides`.  Clears the appearance overrides for a (contextual) reality model.  First argument if supplied is the reality model index, if not supplied then the the tool applies to all reality models.
* `fdt attach reality properties` - Attach a "context" reality model from properties JSON (generally saved from `fdt save reality properties`)
  * the json properties representing a reality model.  These can be created by using the `fdt save reality modelproperties` keyin.
* `fdt save reality properties` - Save reality model properties to the clipboard.  These can then be used by the `fdt attach reality properties` keyin.
  * the name of the context model.  If omitted the first reality model is saved.
* `fdt layer dump` - Dump to the notification manager a JSON representation of the current plan projection settings for the selected viewport. Optional argument `copy` also copies the JSON to the clipboard.
* `fdt layer set` - change plan projection settings for the selected viewport. The first argument is required and specifies the plan projection model(s) to be affected, either as `all` or as a comma-separated list of model Ids (e.g., `0x1c,0x9a`). Subsequent arguments are optional and are used to build a PlanProjectionSettings. Any arguments omitted will get their default values. Only the first character of each argument is significant; the name of the setting is separated from the value by an `=` sign:
  * `transparency=`: transparency in [0..1].
  * `elevation=`: elevation in meters.
  * `overlay=`: 1 to draw as an overlay, 0 to draw normally (with depth).
  * `priority=`: 1 to enforce subcategory display priority, 0 to ignore.
* `fdt subcat priority` - Override display priority of one or more subcategories. Only has an effect on plan projection models. The first argument is a comma-separated list of subcategory Ids; the second is the integer priority value. Omit the second argument to clear the overrides for the specified subcategories.
* `fdt clip color` - Specify or unspecify a clip color to use for pixels inside or outside the clip region. `<color string>` must be in one of the following forms: "rgb(255,0,0)", "rgba(255,0,0,255)", "rgb(100%,0%,0%)", "hsl(120,50%,50%)", "#rrbbgg", "blanchedAlmond" (see possible values from `ColorByName`; case insensitive). At least one argument must be specified. Arguments can be:
  * "clear": Clear all clip colors
  * "inside `<color string>` | clear": Set or clear an inside clip color
  * "outside  `<color string>` | clear": Set or clear an outside clip color
* `fdt sourceId from elemId` and `fdt elemId from sourceId` - Converts between the Id of an element in the iModel and the corresponding object in the source document from which it originated. Outputs the result to IModelApp.notifications.
*   * `id=`: the source aspect Id or element Id.
*   * `copy=`: (optional) 1 to copy the resultant Id to the system clipboard.
* `fdt add extensionService <context>` - Adds a context id to be used with Extension Service. It's added to the front of loaders list, so the most recently added context will get used first. `<context>` can be one of the following:
  * `id <id>`, where `<id>` is a Connected Context GUID.
  * `project <projectName>`.
  * `asset <assetName>`.
  * `public` - loads Bentley-published public extensions.
* `fdt toggle terrain` - Toggle terrain display for background maps.
* `fdt attach maplayer <name>` - Attach a background map layer from name within the map layer source list.  Partial names may be used.
* `fdt attach mapoverlay <name>` - Attach an overlay map layer from name within the map layer source list.  Partial names may be used.
* `fdt set map base <name>` - Set the background base map from name within the map layer source list.  Partial names may be used.
* `fdt set map base color <red, green, blue>` - Set map base color by red, green and blue values [0..255].
* `fdt set map base transparency <transparency>` - Set map base transparency [0..1].
* `fdt detach maplayers` - Detach all map layers.
* `fdt set mapLayer transparency <index, transparency>`.  Set the map layer to the supplied transparency value [0..1].
* `fdt set mapLayer visibility <index, on|off>`.  Set the map layer visibility.
* `fdt reorder maplayer <fromIndex, toIndex>`.  Move the map layer at `fromIndex` to `toIndex`.
* `fdt zoom maplayer <index>` Zoom to map layer. If index is omitted layer 0 is used.
* `fdt attach wms maplayer <URL, name, username, password>` Attach a WMS map layer. WMS is a very common OGC standard map service that produces images on demand.
 The following arguments can be supplied -- only the URL is required.
  * `URL` - The URL for the map layer.
  * `name` - The map layer name. (if not supplied the URL is used)
  * `username` - User Name (only required if credentials are required by server)
  * `password` - Password (only required if credentials are required by server)
* `fdt attach wmts maplayer <URL, name, username, password>` Attach a WTMS map layer. WTMS is an OGC standard map service that produces cached tiles.
The following arguments can be supplied -- only the URL is required.
  * `URL` - The URL for the map layer.
  * `name` - The map layer name. (if not supplied the URL is used)
  * `username` - User Name (only required if credentials are required by server)
  * `password` - Password (only required if credentials are required by server)
* `fdt attach arcgis maplayer <URL, name, username, password>` Attach an ArcGIS map layer.  This uses the ArcGIS rest API directly - the URL in this case will generally end with "MapServer".
The following arguments can be supplied -- only the URL is required.
  * `URL` - The URL for the map layer.
  * `name` - The map layer name. (if not supplied the URL is used)
  * `username` - User Name (only required if credentials are required by server)
  * `password` - Password (only required if credentials are required by server)
* `fdt attach tileurl maplayer <URL, name, username, password>` Attach a map layer from tiles directly from a file server by supplying a URL template.
The following arguments can be supplied -- only the URL is required.
  * `URL` - URL template with level, column and row parameters i.e. "https://b.tile.openstreetmap.org/{level}/{column}/{row}.png"
  * `name` - The map layer name. (if not supplied the URL is used)
  * `username` - User Name (only required if credentials are required by server)
  * `password` - Password (only required if credentials are required by server)
* `fdt aasamples <nSamples>` - Sets the number of antialias samples for the current viewport where nSamples is the number of samples to use; if 1 or less then antialiasing is turned off, if > 1 then antialiasing is turned on and it will attempt to use that many samples (restricted by the given hardware constraints)
The following arguments can also be supplied:
  * `all`: (optional) sets it for all open viewports as well as all future viewports
* `fdt set model color"` Set a color override for a model.  The first three arguments are the red, green and blue color values in [0..255].  The fourth argument if supplied is the model name, if not supplied the override will be applied to all models.
* `fdt set model transparency` Set a transparency override for a model.  The first argument is transparency in [0..1].  The second argument if supplied is the model name, if not supplied the override will be applied to all models.
* `fdt set model locatable`.  Set locatable override for a model. Models are locatable by default.  The first argument must be `true`, `false`, `on` or `off`.  The second argument if supplied is the model name, if not supplied the override will be applied to all models.
* `fdt set model emphasized`.  Sets a model to be emphasized.  The first argument must be `true`, `false`, `on` or `off`.  The second argument if supplied is the model name, if not supplied the override will be applied to all models.
* `fdt set model line weight`.  Sets a model to line weight override.  The first argument must weight in [0..31].  The second argument if supplied is the model name, if not supplied the override will be applied to all models.
* `fdt set model line code`.  Sets a model line code override.  The first argument must be line code in [0..7].  The second argument if supplied is the model name, if not supplied the override will be applied to all models.
* `fdt set model ignores materials`.  Sets a model to be ignore materials.  The first argument must be `true`, `false`, `on` or `off`.  The second argument if supplied is the model name, if not supplied the override will be applied to all models.
* `fdt clear reality model overrides`  Clears appearance overrides for a model. The fist argument if supplied is the model name, if not supplied the override will be applied to all models.
