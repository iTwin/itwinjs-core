# 1.7.0 Change Notes

## Improvements to solar shadows

Several enhancements were made to the display of [SolarShadows]($common):
* The shadow map now continuously refines as new geometry is loaded.
* The position of the solar light is now synchronized with sun direction. See [DisplayStyle3dState.sunDirection]($frontend).
* World decorations no longer receive shadows.
* A display style can now configure whether or not transparent surfaces cast shadows. Any surface whose transparency is greater than the transparency threshold defined by the [DisplayStyle3dState]($frontend) will not cast shadows. See [HiddenLine.Settings.transparencyThreshold]($common).

![shadows transparency](./assets/shadows_transparency.png "Using transparency threshold to control how solar shadows interact with transparent surfaces.")
<p align="center">Solar shadows interacting with transparent surfaces</p>

## Reusable decoration graphics

All [RenderGraphic]($frontend)s created as decorations are automatically disposed to ensure any WebGL resources are freed. This has the unfortunate side effect of preventing such graphics from being reused from one frame to another. If your decorations are expensive to create and/or change infrequently, you can now prevent automatic disposal by wrapping them in a [RenderGraphicOwner]($frontend). By doing so you assume responsibility for properly disposing of them when they are no longer needed. See [RenderSystem.createGraphicOwner]($frontend).

## Spatial classification improvements

* Volume classification is now fully supported.
* Flash and hilite effects are now applied correctly.
* Planar classifiers now support transparency; the classified geometry will use the transparency specified by the classifier geometry.
* Classification of point clouds now works properly.
* Classification now works correctly in perspective views.

## Display system startup options

The following changes have been made to the [RenderSystem.Options]($frontend) used to initialize the [RenderSystem]($frontend) when invoking [IModelApp.startup]($frontend):

* `displaySolarShadows` now defaults to `true` if not defined, instead of false.
* `directScreenRendering` has been deprecated; it no longer has any effect.

## Improvements to ambient occlusion

The default settings for ambient occlusion have been changed to make the effect more subtle, and an option has been added to limit the distance at which the effect will be applied.

## Geometry

* [PolyfaceBuilder.addGreedyTriangulationBetweenLineStrings]($geometry) method to build triangles "between" loosely related linestrings.
* [RegionOps.consolidateAdjacentPrimitives]($geometry) method to consolidate adjacent lines and linestrings, and adjacent arcs of the same underlying circle or ellipse.
* [RegionOps.rectangleEdgeTransform]($geometry) method to decide if a Loop object or point array is a simple rectangle.
* [Range2d.corners3d]($geometry) method to get a `Point3d[]` containing the range corners.
* [GrowableXYArray.length]($geometry) property is writable (e.g. to trim the array)
* [IndexedXYZCollection.getRange]($geometry) -- return the range of data in the collection.
* Support methods for using `PolyfaceVisitor` as staging area for new facets to be given to a `PolyfaceBuilder`
  * [PolyfaceVisitor.clearArrays]($geometry) -- empty all arrays
  * [PolyfaceVisitor.pushDataFrom]($geometry) -- add new point, param, normal, color from indexed position in another `PolyfaceVisitor`
* [PolyfaceVisitor.pushInterpolatedDataFrom]($geometry) -- add new point, param, normal, color interpolated between two indexed positions in another `PolyfaceVisitor`
* `[PolyfaceQuery.cloneWithTVertexFixup]($geometry) -- clone a polyface, inserting vertices within edges that are incident to points on other facets.
* `[PolyfaceQuery.cloneWithColinearEdgeFixup]($geometry) -- clone a polyface, removing mid-edge vertices that are interior to adjacent colinear edges and are _not_ used as non-colinear vertex on any other facet.

## Presentation

### Read-only mode

Added a flag [PresentationManagerProps.mode]($presentation-backend) to indicate that the backend always opens iModels in read-only mode and presentation manager
can make some optimizations related to reacting to changes in iModels. This is an optional property that defaults to previous behavior (read-write), but it's
strongly encouraged to set it to [PresentationManagerMode.ReadOnly]($presentation-backend) on read-only backends.
