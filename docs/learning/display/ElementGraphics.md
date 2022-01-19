# Element Graphics

The [iTwin.js renderer](./index.md) is designed to render [tiles](./Tiles.md), not elements. But in some cases it is useful to display graphics for individual elements. For example, tools that modify the geometry of an element may wish to display a preview of their effects while the user interacts with them. Or, a simulation might want to temporarily animate a handful of elements. Or, a decorator may wish to produce graphics for types of geometry - like BReps and text - that are not supported by the front-end [GraphicBuilder]($frontend).

[TileAdmin.requestElementGraphics]($frontend) accepts either an element Id or an arbitrary [GeometryStream](../common/GeometryStream.md) from which to produce graphics, along with other options like the [chord tolerance](./TileFormat#level-of-detail) specifying the desired level of detail. It returns graphics in [iModel tile format](./TileFormat.md) which can then be supplied to [readElementGraphics]($frontend) to produce a [RenderGraphic]($frontend) for display in a [Viewport]($frontend).

[This sample](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=explode-sample&imodel=House+Sample) demonstrates the use of these APIs to animate an "exploded" view of a set of elements.
