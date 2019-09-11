# @bentley/frontend-devtools

Copyright © 2019 Bentley Systems, Incorporated. All rights reserved.

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
  * `DiagnosticsPanel` - combines all of the above widgets into a single panel.

## Usage

The package must be initialized before use. This can be done when your application starts up, or deferred until first use of the package. The packages' tools will not be registered until the package is initialized.

Example of initializing at start-up:
```ts
  IModelApp.startup();
  await FrontendDevTools.initialize();
```

An easy way to use this package is to instantiate a `DiagnosticsPanel`, supplying a `Viewport` for which the panel will supply diagnostics and tools.
You can then integrate the panel into your UI by appending its `element` HTMLElement to your DOM.

Alternatively, you can embed any configuration of the widgets into your DOM as you like.

Even if you use none of the widgets, initializing the package will make all of its tools available for use, ready to be associated with your own UI entry points or to be executed via key-in. The set of available key-ins can be found in /public/locales/en/FrontendDevTools.json.

## Key-ins

The following key-ins are delivered with this package. Each begins with the prefix `fdt`, short for "Front-end Dev Tools". Use `FrontendDevTools.initialize` to register them for use in your application.

* `fdt save view` - Copies to the clipboard a JSON representation of the view currently displayed in the active viewport.
* `fdt apply view` - Accepts an unquoted JSON representation of a view, e.g., as obtained from `fdt save view`, and applies that view to the active viewport.
* `fdt change view flags` - Changes any number of ViewFlags for the active viewport. Each argument is of the format "flag=value". For boolean flags, the value is `0` for `false` or `1` for `true`. Flag names are case-insensitive.
  * Boolean flags: "dimensions", "patterns", "weights", "styles", "transparency", "fill", "textures", "materials", "acsTriad", "grid", "visibleEdges", "hiddenEdges", "lighting", "shadows", "clipVolume", "constructions", "monochrome", "backgroundMap", "ambientOcclusion", "forceSurfaceDiscard"
  * "renderMode": 0 = wireframe, 3 = hidden line, 4 = solid fill, 6 = smooth shade (numeric values of RenderMode enum).
* `fdt toggle skybox` - If the active viewport is displaying a spatial view, toggles display of the skybox.
* `fdt project extents` - Toggles display of a decoration illustrating the iModel's project extents. Accepts at most 1 argument (case-insensitive):
  * "on": Display the decoration.
  * "off": Stop displaying the decoration.
  * "toggle" or no arguments: Invert the current state.
* `fdt emphasize selection` - Emphasizes all elements in the selection set, and de-emphasizes all other elements by making them semi-transparent and grey.
* `fdt isolate selection` - Causes all elements except those currently in the selection set to stop drawing.
* `fdt clear isolate` - Reverse the effects of `fdt isolate selection`.
* `fdt toggle wiremesh` - Toggles "pseudo-wiremesh" display. This causes surfaces to be rendered using `GL_LINES` instead of `GL_TRIANGLES`. Useful for visualizing the triangles of a mesh - but not suitable for "real" wiremesh display.
* `fdt freeze scene` - Toggles scene freeze for the active viewport. While scene freeze is enabled, the same set of tiles will continue to be displayed until the scene is unfrozen - no new tiles will be loaded. Useful for zooming in or out to inspect geometry inside specific tiles. Accepts at most 1 argument (Case-insensitive):
  * "on": Freeze the scene.
  * "off": Un-freeze the scene.
  * "toggle" or no arguments: Invert the current state.
* `fdt tile bounds` - Sets the type of bounding volume decorations that will be displayed for each tile displayed in the view. Accepts at most one argument; if none is specified, it defaults to "volume":
  * "none": Don't display bounding volumes.
  * "volume": Bounding box representing the full range of each tile.
  * "content": Tighter bounding box representing the range of geometry contained within each tile.
  * "both": Both volume and content boxes.
  * "children": For each tile, draw a box around the volume of each of its child tiles, color-coded such that green indicates an empty child tile and blue a non-empty child tile.
  * "sphere": Bounding sphere representing the full range of each tile.
* `fdt webgl report compatibility` - Opens a modal dialog with information about the client's level of support for various features of the iModel.js display system.
* `fdt webgl lose context` - Force a webgl context loss.
* `fdt frustum selected` - Toggles a decoration representing the current frustum of the selected viewport. The decoration is displayed in any *other* open viewports - so if no other viewports are open, this key-in has no effect. Accepts at most 1 argument (Case-insensitive):
  * "on": Display the decoration.
  * "off": Stop displaying the decoration.
  * "toggle" or no arguments: Invert the current state.
* `fdt frustum snapshot` - Toggles a decoration representing the current frustum of the active viewport. The decoration remains displayed until it is toggled back off. `fdt frustum selected` is much more useful, but requires at least two open viewports. Accepts at most 1 argument (Case-insensitive):
  * "on": Display the decoration.
  * "off": Stop displaying the decoration.
  * "toggle" or no arguments: Invert the current state.
* `fdt visibility` - Controls whether instanced, un-instanced (batched), or all geometry is displayed in the active viewport. Accepts at most one argument; defaults to "all" if none is specified:
  * "instanced": Display only instanced geometry.
  * "batched": Display only un-instanced (batched) geometry.
  * "all": Display all geometry.
* `fdt toggle readpixels` - Toggles "read pixels" mode on the active viewport. In this mode, geometry is rendered to the screen as if it was being rendered off-screen for element locate purposes.
* `fdt toggle logz` - Toggles the use of a logarithmic depth buffer for the active viewport.
* `fdt inspect element` - Creates a readable text summary of a geometric element or geometry part. The keyin takes the following arguments, all of which are optional:
  * "id=elementId" where "elementId" is a hexadecimal element Id such as `0x12cb`;
  * "symbology=0|1" where `1` indicates detailed symbology information should be included in the output;
  * "placement=0|1" where `1` indicates detailed geometric element placement should be included; and
  * "verbosity=0|1|2" controlling the verbosity of the output for each geometric primitive in the geometry stream. Higher values = more detailed information. Note `verbosity=2` can produce megabytes of data for certain types of geometric primitives like large meshes.
  * "modal=0|1" where `1` indicates the output should appear in a modal dialog.
  * If no id is specified, the tool runs in interactive mode: first operating upon the selection set (if any), then allowing the user to select additional elements.
