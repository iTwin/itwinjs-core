# Tiles

The [iTwin.js display system](./overview.md) is responsible for visualizing vast amounts of data from a wide variety of sources, within the constraints of a web browser. It achieves this primarily through the use of [Tile]($frontend)s - a mechanism by which the geometry of a large model is partitioned into a hierarchy of sub-volumes, with each sub-volume representing a portion of the model's geometry at a particular level of detail. The result is a [TileTree]($frontend) that can be efficiently queried for the set of tiles required to render only the portion of the model corresponding to the volume of space the user is currently looking at, at a level of detail appropriate for the currently viewing [Frustum]($common) and [Viewport]($frontend) resolution.

The display system can aggregate different types of tiles from a broad variety of sources, including:

- iModels, in the form of [tiles produced by the iTwin.js backend](./TileFormat.md);
- Reality meshes and point clouds in standard [3d tile formats](https://github.com/CesiumGS/3d-tiles) such as those produced by [Bentley ContextCapture](https://www.bentley.com/en/products/product-line/reality-modeling-software/contextcapture);
- Point clouds in [OrbitGT](https://orbitgt.com/) format;
- Map imagery from a wide variety of sources including [Bing](https://www.microsoft.com/en-us/maps) and [MapBox](https://www.mapbox.com/);
- 3d world-wide terrain meshes from [Cesium ION](https://cesium.com/platform/cesium-ion/content/cesium-world-terrain/);
- World-wide building meshes supplied by [OpenStreetMap](https://osmbuildings.org/);
- 3d tiles of any format supplied by an application via @[TiledGraphicsProvider]($frontend)s;

Cesium's [3d tiles reference card](https://github.com/CesiumGS/3d-tiles/blob/main/3d-tiles-reference-card.pdf) provides a good overview of general concepts, along with some details specific to the standard 3d tile formats.

Tiles produced by the iTwin.js backend use the [iModel tile format](./TileFormat.md), which differs from other formats in many ways.

## Scene creation


## Resource management

