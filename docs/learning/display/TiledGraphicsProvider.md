# TiledGraphicsProvider

The [iTwin.js display system](./index.md) provides out-of-the-box support for [tiles](./Tiles.md) from a wide variety of sources, but in some cases an application may wish to display their own custom graphics in a [Viewport]($frontend). For relatively simple graphics, [view decorations](../frontend/ViewDecorations.md) are often an appropriate choice. However, for more complex graphics, the application can instead implement a [TiledGraphicsProvider]($frontend) to supply tiles to be rendered as part of the scene.

To register your provider with a viewport, use [Viewport.addTiledGraphicsProvider]($frontend); to unregister it, use [Viewport.dropTiledGraphicsProvider]($frontend). Note that a given provider can be registered with any number of viewports at any given time.

The `TiledGraphicsProvider` interface defines only three methods, and all but one of these are optional:

- [TiledGraphicsProvider.forEachTileTreeRef]($frontend): This method enables the display system to iterate all of the [TileTreeReference]($frontend)s exposed by the provider and execute a function on each one. Your implementation should simply invoke the supplied function once for each tile tree reference associated with the specified [Viewport]($frontend).
- [TiledGraphicsProvider.addToScene]($frontend): This method is invoked when it is time to draw your tiles into a viewport. If your provider does not implement this method, then `forEachTileTreeRef` will be invoked to call [TileTreeReference.addToScene]($frontend) on each reference.
- [TiledGraphicsProvider.isLoadingComplete]($frontend): This method returns true if all of the [TileTree]($frontend)s required by your provider are ready for use. You may need to implement this method if you must perform some asynchronous work before your tile trees are ready; otherwise, `forEachTileTreeRef` will be invoked  to call [TileTreeReference.isLoadingComplete]($frontend) on each reference.

Of course, implementing `forEachTileTreeRef` implies that you will instantiate one or more [TileTreeReference]($frontend)s, which in turn means you will probably need to implement subclasses of [TileTree]($frontend) and/or [Tile]($frontend). [This example](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=explode-sample&imodel=House+Sample) provides a sample implementation of a `TiledGraphicsProvider` capable of animating an "exploded" view of a set of elements.
