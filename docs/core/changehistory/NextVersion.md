---
ignore: true
---
# NextVersion

## Update to TypeScript 3.5

For the 1.0 release, iModel.js was using TypeScript 3.2. In order to take advantage of recent improvements, iModel.js has moved up to TypeScript 3.5. One of the main features of interest was the incremental build support. TypeScript 3.5 also includes some enhanced error checking over what was available in 3.2. This makes it easier to identify potential problems, but also may mean that source code that successfully compiled using 3.2 may require minor adjustments to compile using 3.5.

Please see the [TypeScript Roadmap](https://github.com/Microsoft/TypeScript/wiki/Roadmap) for more details.

## New frontend-devtools package

The new `frontend-devtools` package contains a collection of simple UI widgets providing diagnostics and customization related to the display system. These include:

  * `MemoryTracker` - reports on total GPU memory usage, breaking it down by different types of objects like textures and buffers. Memory can be reported for all tile trees in the system or only those currently displayed in the viewport.
  * `FpsTracker` - reports average frames-per-second. Note: this forces the scene to be redrawn every frame, which may impact battery life on laptops and mobile devices.
  * `TileStatisticsTracker` - reports exhaustive tile request statistics, including the current numbers of active and pending requests, the total number of completed, dispatched, failed, and timed-out requests, and more.
  * `ToolSettingsTracker` - allows settings affecting the operation of viewing tools to be customized.

These widgets may be used in any combination. Alternatively, `DiagnosticsPanel` bundles them all together as a set of expandable panels along with a handful of other features like freezing the current scene, controlling display of tile bounding boxes, and hiding particular types of geometry.

![Diagnostics Panel](./assets/diagnostics_panel.png)

## Display system optimizations

Many incremental enhancements contributed to improved performance and quality of the rendering system and decreased memory usage, including:

  * Reducing the number of tiles requested and expediently cancelling requests for tiles which are no longer needed.
  * Improving culling logic - this particularly improves performance when a clip volume is applied to the view.
  * Reclaiming memory from not-recently-drawn tiles.
  * Decompressing texture images in the background using web workers.
  * Eliminating distortion of text, and of the skybox in orthographic views.
  * Enabling tiles to be downloaded without edge data, and optimizing shaders to more efficiently render tiles without edges.


