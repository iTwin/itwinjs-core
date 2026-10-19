# Referencing Linked iModels

Linked iModels let a spatial view display multiple iModels together. This is useful when a site iModel provides the overall context and separate iModels describe buildings, plants, or other assets located at that site. The primary iModel establishes the view's coordinate system; each linked iModel is displayed through its own reference and transformed into that coordinate system.

Each iModel is represented by an [IModelDisplayReference]($frontend), which specifies the subset of its content to display, such as models, categories, and elements. References can be styled independently, with their own symbology overrides, view flags, and other display settings.

> Showing the measure distance tool being used to report the distance between a point in the primary reference and points in each linked imodel.
>
![linked iModels](./linked-imodels.png "A site iModel with a plant and office building displayed as linked iModels.")

```ts
const refs = viewport.iModelRefs;
if (!refs.isSpatial)
  throw new Error("Linked iModels require a spatial view");

const buildingRef = refs.link({ iModel: buildingIModel });
```

## Scope and interaction

Links are managed directly by a spatial view's `iModelRefs` collection: use [SpatialIModelDisplayReferences.link]($frontend) to add a reference and `unlink` to remove it. Linked references do not contain their own links, so links are not nested. Drawing and sheet views are 2D and currently expose only their primary iModel reference.

Displaying an iModel does not automatically make it available to every interaction tool. Picking linked content is opt-in through [LocateOptions.allowExternalIModels]($frontend), which is `false` by default. When enabled, handle the hit's [HitDetail.iModelRef]($frontend) rather than assuming it came from the primary iModel. Tools that do not opt in continue to operate on the primary iModel.

For selection across linked iModels, applications can make [MultiIModelSelectionTool]($frontend) the default tool:

```ts
IModelApp.toolAdmin.defaultToolId = MultiIModelSelectionTool.toolId;
```

This tool opts in to linked-model hits and updates the selection set belonging to each hit's iModel.

## Geolocation

An iModel's geolocation describes how its spatial coordinates relate to positions on Earth. Geolocation does not determine whether an iModel can be linked; it determines the transform iTwin.js can compute to place the linked iModel in the primary iModel's coordinate system.

### Non-geolocated

A non-geolocated iModel uses an arbitrary coordinate system with no defined relationship to the real world. It has no ECEF location, so iTwin.js cannot calculate where it belongs relative to a geolocated site. If either the primary or linked iModel has no ECEF location, the linked reference uses an identity transform. The coordinates are therefore treated as already being in the primary iModel's coordinate system; unrelated local coordinates will not automatically line up.

### Linear Geolocation

A geolocated iModel that has a linear transform from its spatial coordinates to Earth-Centered, Earth-Fixed (ECEF) coordinates. This is typical for buildings, plants, and campuses, where the project covers a limited area and a single translation and rotation are sufficient.

When both the primary and linked iModels have valid ECEF locations, iTwin.js composes their transforms to map the linked iModel into the primary iModel's coordinates. This lets a building iModel be positioned relative to a geolocated site iModel.

### Projected Geolocation

A geolocated iModel that has a non-linear map projection to relate its coordinates to Earth. Its ECEF location provides a linear approximation, but the full projected conversion is non-linear.

Linked iModels currently use the linear ECEF transforms; they do not perform the non-linear GCS reprojection when linking. The approximation is most useful near the iModel's ECEF reference location and becomes less accurate farther from it. As a result, geolocated iModels with different GCS definitions or large extents may not align precisely when linked.

For details on ECEF locations, GCS, and coordinate conversion, see [GeoLocation of iModels](./GeoLocation.md).
