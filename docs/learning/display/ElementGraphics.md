# Element Graphics

The [iTwin.js renderer](./frontend-overview) is optimized for display of [tiles](./overview.md#tiles), but in some cases it is useful to display graphics for individual elements. For example, tools that modify the geometry of an element may wish to display a preview of their effects while the user interacts with them. Given an element Id, chord tolerance, and various other options, @[TileAdmin.requestElementGraphics]($frontend) obtains graphics in [iModel tile format](./TileFormat.md) for that element. The same API can be supplied with an arbitrary geometry stream instead of an element Id to produce decoration graphics for types of geometry unsupported on the front-end, such as text and BReps.

[This sample](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=explode-sample&imodel=House+Sample) demonstrates the use of this API to produce an animated "exploded" view of a set of elements.
