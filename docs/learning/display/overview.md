# iTwin.js Display System Overview

The iTwin.js display system is responsible for producing and rendering graphics to enable visualization of the contents of an iTwin. Those contents can include iModels, reality models, IoT sensor data, map imagery, and other data sources. Applications can also provide their own graphics via [Decorators](../frontend/ViewDecorations.md) and [TiledGraphicsProvider](./TileGraphicsProvider.md)s.

The display system is divided into two subsystems:
- The WebGL-based [tile renderer](./frontend-overview.md) running on the [frontend](../frontend/index.md), responsible for requesting and display tiles; and
- The native-code tile generator running on the [backend](../backend/index.md), responsible for [producing tiles](./TileFormat.md) from the contents of an iModel.

A [caching layer](./TileCache.md) may be introduced between the frontend and backend subsystems to supply previously-generated tiles; or the backend may maintain its own internal cache.

## Tiles

iTwin.js is designed to support visualization of very large infrastructure digital twins. Consider the example of a large factory containing thousands of pieces of equipment. Each piece of equipment may be modeled to a level of detail up to and including its various nuts and bolts. A typical display system would draw each piece of equipment one at a time, until it had finished drawing them all. Therefore, the scene graph constructed by such a system consists of a large collection of small, detailed objects. Let's call this an "object-based" renderer.

An object-based renderer is relatively straightforward to implement and works well for smaller models, but encounters performance problems when scaling to larger models because:

- Sending many smaller objects to the GPU is slower than sending fewer, larger objects. We refer to each object as a "draw call"; fewer draw calls allow the GPU to perform more efficiently.
- Small, highly-detailed objects require more GPU processing. If the user has zoomed out to view the entire factory, he won't be able to distinguish each individual nut and bolt, yet the GPU is still asked to draw all of them, resulting in many more triangles being drawn than necessary to produce a good image.
- Small, highly-detailed objects require more memory, even if they are not currently being drawn as part of the scene.

A tile-based renderer tries to solve these scalability problems by minimizing the number of draw calls and by keeping the number of triangles drawn relatively constant regardless of the size of the viewing frustum. Picture the same large factory model, and draw a box around it enclosing its contents. Now imagine drawing that box in a 512x512 pixel square. At that level of detail, none of the little nuts and bolts will be discernible - in fact many entire pieces of equipment may be smaller than one pixel at that scale. That box represents the root tile of the lowest level of detail in a hierarchical tree of tiles in which each level of the tree provides tiles representing a smaller volume of  the model, but at a greater level of detail. Take the root tile's volume and divide it along each of its axes into eight sub-volumes. Now draw the portions of the factory within each of those sub-volumes into the same 512x512 pixel square. Each will have twice the level of detail as the root tile, but approximately the same number of triangles.

When [creating the scene](./frontend-overview.md#scene-creation), the renderer chooses tiles that (1) intersect the viewing volume and (2) provide sufficient level of detail in screen pixels. When the user zooms out, it selects larger, less detailed tiles; when she zooms in, it selects smaller, more detailed tiles.

Because the scene graph consists of tiles instead of objects, the display system can make use of "batching" to combine many individual objects into a single draw call. For example, if ten pieces of equipment all use the same material, the display system may combine all of their triangles into a single mesh, allowing them to be drawn with one draw call instead of ten.

The iTwin.js tile generator batches quite aggressively. For example, it usese material atlases and color indexes, allowing objects using up to 255 different materials and 16,535 distinct colors to be combined into a single mesh. It also produces glyph atlases to permit an unbounded number of individual characters of text to be batched into a single draw call.

Tiles also enable the renderer to reduce the amount of memory consumed by the frontend graphics. For example, instead of using 3 32-bit floating point numbers to store the position of each triangle vertex, those positions are quantized to the range of the tile's volume as 16-bit integers, cutting in half the amount of memory required.
