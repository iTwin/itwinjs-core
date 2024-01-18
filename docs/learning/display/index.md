# The iTwin.js Display System

The iTwin.js display system is responsible for producing and rendering graphics to enable visualization of the contents of an iTwin. Those contents can include iModels, reality models, IoT sensor data, map imagery, and other data sources. Applications can also provide their own graphics via [Decorators](../frontend/ViewDecorations.md) and [TiledGraphicsProvider](./TiledGraphicsProvider.md)s.

The display system is divided into two subsystems:
- The WebGL-based tile renderer running on the [frontend](../frontend/index.md), responsible for displaying the contents of [Viewport]($frontend)s; and
- The native-code tile generator running on the [backend](../backend/index.md), responsible for producing tiles in [iMdl format](./TileFormat.md) from the contents of an iModel.

A [caching layer](./TileCache.md) may be introduced between the frontend and backend subsystems to supply previously-generated tiles; or the backend may maintain its own internal cache.

This documentation concerns itself primarily with the frontend portion of the display system; documentation for the backend tile generator is limited to an overview of the [iModel tile format](./TileFormat.md).

## Features

- [Tile-based rendering](./Tiles.md)
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
- [Multi-sample anti-aliasing](./MSAA.md)
- [Wiremesh display](./Wiremesh.md)

## Configuration

The renderer's responsibilities are divided between two objects:

- The [TileAdmin]($frontend) coordinates requests for [tiles](./Tiles.md) and manages their lifetimes to limit memory consumption. It can be accessed via [IModelApp.tileAdmin]($frontend) and configured at startup via [IModelAppOptions.tileAdmin]($frontend).
- The [RenderSystem]($frontend) communicates with the graphics hardware via [WebGL](https://ww.khronos.org/webgl/) to allocate resources like [RenderGraphic]($frontend)s and [RenderTexture]($common)s and to draw the contents of [Viewport]($frontend)s onto the screen. It can be accessed via [IModelApp.renderSystem]($frontend) and configured at startup via [IModelAppOptions.renderSys]($frontend).

## WebGL

Because the renderer runs in a browser environment, it uses [WebGL](https://www.khronos.org/webgl/) under the hood to communicate with graphics hardware. However, the WebGL context is not exposed for use by applications. Instead, abstractions like [GraphicBuilder]($frontend) and [RenderSystem]($frontend) provide higher-level APIs for working indirectly with WebGL resources.

The renderer supports an arbitrary number of [Viewport]($frontend)s, all sharing a single WebGL context to reduce duplication of resources like shaders, textures, and tiles. Viewports can be positioned freely relative to one another, with or without overlap.

The renderer will attempt to use WebGL 2, which provides more features and better performance than WebGL 1; but will fall back to WebGL 1 on devices that lack support for WebGL 2. At the time of writing, the Safari browser has finally received official support for WebGL 2 (in macOS Monterey and iOS 15), making WebGL 2 support nearly universal. Still, some advanced features of the renderer may be unsupported on some devices; consult the [compatibility checker](https://connect-imodeljscompatibility.bentley.com/) to determine which features may be unavailable on your device.

Major modern browsers are supported, including Firefox, Safari, and chromium-based browsers (Chrome, Electron, Brave, "new" Edge, etc). Optimal graphics performance is observed in chromium-based browsers. Internet Explorer and "old" Edge are not supported.
