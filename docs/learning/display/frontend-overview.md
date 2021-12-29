# iTwin.js Renderer Overview

The renderer is the frontend component of the [iTwin.js display system](./overview.md) responsible for visualizing the contents of an iTwin within a [Viewport]($frontend).

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

Because the renderer runs in a browser environment, it uses [WebGL](https://www.khronos.org/webgl/) under the hood to communicate with graphics hardware. However, the WebGL context is not exposed for use by applications. Instead, abstractions like [GraphicBuilder]($frontend) and [RenderSystem]($frontend) provide higher-level APIs for working indirectly with WebGL resources.

The renderer supports an arbitrary number of [Viewport]($frontend)s, all sharing a single WebGL context to reduce duplication of resources like shaders, textures, and tiles. Viewports can be positioned freely relative to one another, with or without overlap.

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
- 3d tiles of any format supplied by an application via [TiledGraphicsProvider](./TileGraphicsProvider.md)s;

Additionally, the application can augment the scene with [decoration graphics](../frontend/ViewDecorations.md).

