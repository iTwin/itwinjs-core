---
ignore: true
---
# NextVersion

## 3D Globe Background Map Display

The background map can now be displayed as either a plane or a three-dimensional globe. This is controlled by the [GlobeMode]($common) property of the [DisplayStyleSettings.backgroundMap]($common) associated with a [DisplayStyleState]($frontend) or [DisplayStyle]($backend).
  * [GlobeMode.Columbus]($common) projects the map onto the XY plane.
  * [GlobeMode.ThreeD]($common) - the default mode - projects the map onto the [WGS84](https://en.wikipedia.org/wiki/World_Geodetic_System) ellipsoid when sufficiently zoomed-out.

In Columbus mode, or in 3d mode when sufficiently zoomed-in on the iModel, the iModel's [geographic coordinate system](https://www.imodeljs.org/learning/geolocation/#the-geographic-coordinate-system) is used to transform the map into the iModel's coordinate space.

![Columbus mode](assets/ColumbusMapProjection.png)
<p align="center">Columbus mode</p>

![Globe mode](assets/3DMapProjection.png)
<p align="center">Globe mode</p>

### Globe View Tools
The following are view tools that allow a user to navigate a plane or three-dimensional globe. All of these tools operate on the selected view.
* [ViewGlobeSatelliteTool]($frontend) views a location on the background map from a satellite's perspective; the viewed location is derived from the position of the current camera's eye above the map.
* [ViewGlobeBirdTool]($frontend) views a location on the background map from a bird's eye perspective; the viewed location is derived from the position of the current camera's eye above the globe.
* [ViewGlobeLocationTool]($frontend) views a location on the background map corresponding to a specified string. This will either look down at the location using a bird's eye height, or, if a range is available, the entire range corresponding to the location will be viewed.
* [ViewGlobeIModelTool]($frontend) views the current iModel on the background map so that the extent of the project is visible.

[ViewGlobeSatelliteTool]($frontend), [ViewGlobeBirdTool]($frontend), and [ViewGlobeIModelTool]($frontend) run in the following manner:
  * The tool, once constructed, will execute when its `onDataButtonDown` or `onPostInstall` methods are called.
  * `onDataButtonDown` will execute the tool if its `BeButtonEvent` argument has a defined `viewport` property. It will use that viewport.
  * `onPostInstall` will use the viewport specified in the tool's constructor. If that does not exist, it will use `IModelApp.viewManager.selectedView`.

[ViewGlobeLocationTool]($frontend) runs in the following manner:
  * The tool, once constructed, will execute when its `parseAndRun` method is called.
  * To navigate to a precise latitude/longitude location on the map, specify exactly two numeric arguments to `parseAndRun`. The first will be the latitude and the second will be the longitude. These are specified in degrees.
  * To search for and possibly navigate to a named location, specify any number of string arguments to `parseAndRun`. They will be joined with single spaces between them. If a location corresponding to the joined strings can be found, the tool will navigate there.

## Breaking API changes

With a new major version of the iModel.js library come breaking API changes. The majority of those changes result from the removal of previously deprecated APIs. In addition, the following APis have changed in ways that may require calling code to be adjusted:

### GeometryStream iteration

The [GeometryStreamIteratorEntry]($common) exposed by a [GeometryStreamIterator]($common) has been simplified down to only four members. Access the geometric primitive associated with the entry by type-switching on its `type` property. For example, code that previously looked like:
```ts
function tryTransformGeometry(entry: GeometryStreamIteratorEntry, transform: Transform): void {
  if (undefined !== entry.geometryQuery)
    return entry.geometryQuery.tryTransformInPlace(transform);

  if (undefined !== entry.textString) {
    entry.textString.transformInPlace(transform);
    return true;
  } else if (undefined !== entry.image)
    entry.image.transformInPlace(transform);
    return true;
  }
  // etc...
}

```

Is now written as:
```ts
function tryTransformGeometry(entry: GeometryStreamIteratorEntry, transform: Transform): void {
  switch (entry.primitive.type) {
    case "geometryQuery":
      // The compiler knows that entry.primitive is of type AnyGeometryQuery
      return entry.primitive.geometryQuery.tryTransformInPlace(transform);
    case "textString":
    case "image":
      // The compiler knows that entry.primitive is a TextString or an ImageGraphic, both of which have a transformInPlace() method
      entry.primitive.transformInPlace(transform);
      return true;
    // etc...
  }
}
```

## Geometry

### Bug fixes
 * Apply on-plane tolerances in mesh-plane clip. (https://bentleycs.visualstudio.com/iModelTechnologies/_workitems/edit/273249/)
