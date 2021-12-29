# iTwin.js Renderer Overview

The renderer is the frontend component of the [iTwin.js display system](./overview.md) responsible for visualizing the contents of an iTwin within a @[Viewport]($core-frontend).

## Features

- [Lighting, materials, and environment](./Lighting.md)
- [Clipping and section-cut graphics](./Clipping.md)
- [2d drawings and sheets](./DrawingsAndSheets.md)
- [Hyper-modeling](./HyperModeling.md)
- [Edge display](./EdgeDisplay.md)
- [Appearance overrides](./SymbologyOverrides.md)
- [Particle effects](./ParticleEffects.md)
- [Screen-space effects](./ScreenSpaceEffects.md)
- [Classification and masking](./Classification.md)
- [Thematic visualization](./ThematicDisplay.md)
- [Timeline animation](./TimelineAnimation.md)
- [Element graphics](./ElementGraphics.md)
- [Multi-sample anti-aliasing](https://en.wikipedia.org/wiki/Multisample_anti-aliasing)

## Configuration

The renderer's responsibilities are divided between two objects:

- The [TileAdmin]($frontend) coordinates requests for [TileTree]($frontend)s and [Tile]($frontend) contents and manages their lifetimes to limit memory consumption. It can be accessed via [IModelApp.tileAdmin]($frontend) and configured at startup via [IModelAppOptions.tileAdmin]($frontend).
- The [RenderSystem]($frontend) communicates with the graphics hardware via [WebGL](https://ww.khronos.org/webgl/) to allocate resources like [RenderGraphic]($frontend)s and [RenderTexture]($common)s and to draw the contents of [Viewport]($frontend)s onto the screen. It can be accessed via [IModelApp.renderSystem]($frontend) and configured at startup via [IModelAppOptions.renderSys]($frontend).

## WebGL

Because the renderer runs in a browser environment, it uses [WebGL](https://www.khronos.org/webgl/) under the hood to communicate with graphics hardware. However, the WebGL context is not exposed for use by applications. Instead, abstractions like @[GraphicBuilder]($frontend) and @[RenderSystem]($frontend) provide higher-level APIs for working indirectly with WebGL resources.

The renderer supports an arbitrary number of @[Viewport]($frontend)s, all sharing a single WebGL context to reduce duplication of resources like shaders, textures, and tiles. Viewports can be positioned freely relative to one another, with or without overlap.

The renderer will attempt to use WebGL 2, which provides more features and better performance than WebGL 1; but will fall back to WebGL 1 on devices that lack support for WebGL 2. At the time of writing, the Safari browser has finally received official support for WebGL 2 (in macOS Monterey and iOS 15), making WebGL 2 support nearly universal. Still, some advanced features of the renderer may be unsupported on some devices; consult the [compatibility checker](https://connect-imodeljscompatibility.bentley.com/) to determine which features may be unavailable on your device.

Major modern browsers are supported, including Firefox, Safari, and chromium-based browsers (Chrome, Electron, Brave, "new" Edge, etc). Optimal graphics performance is observed in chromium-based browsers. Internet Explorer and "old" Edge are not supported.

## Supported data sources

The renderer displays 2d and 3d scenes composed of tiles obtained from any number of [tile trees](./overview.md#tiles). A scene can aggregate tiles from any combination of the following sources:

- iModels, in the form of tiles produced by the backend [tile generator](./backend-overview.md);
- Reality meshes and point clouds in standard [3d tile formats](https://github.com/CesiumGS/3d-tiles) such as those produced by [Bentley ContextCapture](https://www.bentley.com/en/products/product-line/reality-modeling-software/contextcapture);
- Point clouds in [OrbitGT](https://orbitgt.com/) format;
- Map imagery from a wide variety of sources including [Bing](https://www.microsoft.com/en-us/maps) and [MapBox](https://www.mapbox.com/);
- 3d world-wide terrain meshes from [Cesium ION](https://cesium.com/platform/cesium-ion/content/cesium-world-terrain/);
- World-wide building meshes supplied by [OpenStreetMap](https://osmbuildings.org/);
- 3d tiles of any format supplied by an application via @[TiledGraphicsProvider]($frontend)s;

Additionally, the application can augment the scene with @[decoration graphics](../frontend/ViewDecorations.md).

## Scene creation

To construct the scene graph, the renderer asks each tile tree in the scene to supply tiles appropriate for the current view. Typically, that process looks something like the following, beginning with the root tile:

```
If the tile intersects the viewed volume and any clip volumes applied to the view or model:
  If the tile is of appropriate level of detail for the current view:
    If the tile's graphics are loaded:
      Select the tile for display.
    Otherwise:
      Select the tile for loading.
      If the graphics of the tile's direct descendants are loaded:
        Select the descendant tiles for display.
      Otherwise, if the graphics of the tile's direct ancestor are loaded:
        Select the parent tile for display.
  Otherwise:
    Repeat the process for each of the tile's direct descendants.
```

The graphics of all tiles selected for display are added to the scene graph. The renderer then deconstructs the graph into an ordered sequence of render commands organized into several render passes. These commands are submitted to the GPU for drawing.

## Tile loading

A tile typically comes into existence with no graphics - its graphics are only loaded when (if) the tile is selected for display during scene creation. The @[TileAdmin]($frontend) maintains a queue of tile content requests. At any given time, a maximum of N content requests may be "in flight"; the rest reside on a priority queue. The precise maximum depends on the application configuration; for web apps, it defaults to 10 to account for limitations of HTTP/1.1; for desktop and mobile apps, it is based on the hardware concurrency of the client device. Pending requests are removed from the queue when canceled - e.g., if the viewing frustum changes such that the tile's graphics are no longer required for display in any viewport.

## Resource management

Tile graphics consume graphics memory, and the tiles themselves consume JavaScript heap memory. Tiles are routinely discarded after a configurable period of disuse, along with their WebGL resources and all of their descendants. Entire tile trees are likewise discarded after a (usually longer) period of disuse.

Each tile keeps track of the total amount of memory it has requested from WebGL. The @[TileAdmin]($frontend) can be configured with a graphics memory limit; if the total amount of memory consumed by tiles exceeds this limit, the graphics of the least-recently-used tiles are discarded until the limit has been satisfied. The tiles themselves are not discarded; nor are the graphics of any tile that is currently selected for display in any viewport. This limit requires careful balancing: a limit too low may cause excessive repeated requests for the same tile content, while a limit too high risks exceeding the client's available graphics memory, typically resulting in context loss.

