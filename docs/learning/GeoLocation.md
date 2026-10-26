# GeoLocation of iModels

An iModel is a digital representation of an infrastructure asset or project, as a part of an Infrastructure Digital Twin. As such, the expectation is that every iModel can be positioned at one permanent location on the earth. The conversion from [Cartesian](https://en.wikipedia.org/wiki/Cartesian_coordinate_system) points in [SpatialModel]($backend)s to a location on the earth in [Cartographic]($common) coordinates is referred to as the *GeoLocation* of an iModel.

That conversion can be in 3 different forms for any given iModel, depending on the source data:

1. Unknown
2. Linear
3. Projected

If no location information is available, we say that such an iModel is **not GeoLocated**, and GeoLocation conversion attempts will fail.

One simple way to understand the difference between a *Linear GeoLocation* iModel and a *Projected GeoLocation* iModel is to examine "what does the z axis mean"?

- For iModels of structures such as a Plant, Building, Substation, or even a Campus, the z axis typically means *height above the ground floor* or some other base point. Then, Z=0 is an infinite plane with no consideration for the curvature of the earth (i.e. lines in the z direction are *not* necessarily directed towards the center of the earth.) Obviously such iModels can only encompass a small area, so that the curvature of the earth doesn't really matter - generally a few kilometers. The conversion from [Cartesian](https://en.wikipedia.org/wiki/Cartesian_coordinate_system) **{x,y,z}** to [Cartographic]($common) **{lat,long,height}** coordinates is accomplished through a [linear transform](#ecef-transform) about a single point. Source applications such as Bentley's Open Building Designer, OpenPlant, and Revit create iModels with Linear GeoLocation.

- For iModels that are created from mapping data, the z axis usually means some form of *height above the earth's surface* (e.g. sea level, terrain, ellipsoid, etc.) Therefore the Z=0 plane in the iModel *projects*  the earth's ellipsoid, and lines in the z-direction always point towards the center (elliptical centroid) of the earth. Cartesian **{x,y,z}** values are converted to [Cartographic]($common) **{lat,long,height}** coordinates via a non-linear [map projection](https://en.wikipedia.org/wiki/Map_projection), the description of which is stored in the iModel as as [Geographic Coordinate System](#the-geographic-coordinate-system). Source applications such as Bentley Map, OpenRoads, Civil 3D, GIS applications, etc. create iModels with Projected GeoLocation.

## The IModel class

Information about GeoLocation is available in iTwin.js from the [IModel]($common) class, on instances of it subclasses:

- [IModelConnection]($frontend) in the frontend
- [IModelDb]($backend) in the backend

### Spatial Coordinates in iModels

There is only one spatial coordinate system in an iModel for all [SpatialModel]($backend)s. This allows iModels to have an index of all [SpatialElement]($backend)s for fast [Spatial Queries](./SpatialQueries.md).

> Coordinates in iModels are always stored in Meters, regardless of the units used by source applications. There ways to display coordinate/distance/volume/etc. values in other units, but internally they are *always* Meters.

### The Project Extents

It is often helpful to know the *volume of space of interest* for an iModel (e.g. for a "zoom to extents" command, or limiting volumes for Geometric queries.) To facilitate this, iModels hold a property called **Project Extents** that is an [Axis Aligned Bounding Box](https://en.wikipedia.org/wiki/Minimum_bounding_box#Axis-aligned_minimum_bounding_box) that defines the extrema for {X,Y,Z} coordinates in the iModel. Any elements, or parts of elements, outside of [IModel.projectExtents]($common) are considered invalid and are not displayed.

As mentioned above, the Project Extents are aligned with the axes of of the project. To convert the Project Extents into a shape in [Cartographic]($common) coordinates, or to determine the minimum and maximum lat/long, you can use logic like:

```ts
[[include:ProjectExtents_toCartographic]]
```

### The Global Origin

All spatial coordinate values are stored in an iModel in [IEEE 754](https://en.wikipedia.org/wiki/IEEE_754) floating point numbers. As such, the highest precision is obtained by numbers close to zero. For this reason, it is sometimes desireable to store a *bias distance* to be added to all coordinates. This value is called the **Global Origin** for an iModel, and it applies to all spatial coordinates. The Global Origin may be obtained by [IModel.globalOrigin]($common).

> Notes about Global Origin:

- Global Origin only apples to Spatial Models.
- The Global Origin is added to spatial coordinates *before* converting them to Cartographic coordinates.

### The ECEF Location

The [Earth Centered Earth Fixed](https://en.wikipedia.org/wiki/ECEF) coordinate system is a Cartesian Coordinate system with its origin at the center of mass of the Earth. This forms a convenient reference frame for describing a linear transformation to position an iModel on the earth. This is held in [IModel.ecefLocation]($common). There are two parts of the ECEF Location:

- the position of the iModel's Global Origin in ECEF coordinates
- the [YawPitchRollAngles]($geometry) that is the rotation from the iModel's Spatial coordinates to ECEF coordinates

> Notes about [IModel.ecefLocation]($common):

- For iModels that are not GeoLocated, [IModel.ecefLocation]($common) will be undefined.
- For iModels with Linear GeoLocation, there will be a ECEF Location, but no GCS.
- For iModels with Projected GeoLocation, there *will* be a valid ECEF Location. This can be used as a (sometimes very rough) approximation for converting to Cartographic coordinates without requiring a (sometimes very expensive) round-trip to a server for the full non-linear projection calculation. The approximation gets worse as the distance from the center of the project extents increases.

- There is a convenience method [IModel.getEcefTransform]($common) to get the ECEF location as a [Transform]($geometry).

### The Geographic Coordinate System

A projected iModel stores information used to convert its spatial coordinates to/from [Cartographic]($common) points in a property known as its "GCS" (Geographic Coordinate System). Its [GeographicCRS]($common) describes the horizontal [Geodetic datum](https://en.wikipedia.org/wiki/Geodetic_datum) and [Map projection](https://en.wikipedia.org/wiki/Map_projection), and can also identify a vertical coordinate reference system that defines the meaning of elevations. The GCS is available through [IModel.geographicCoordinateSystem]($common). The non-linear conversion can only be done on the backend, often with the use of external data tables.

> For historical reasons, some applications such as MicroStation store a GCS, even for a Linear GeoLocation. This means that some iModels that are really Linear iModels instead appear as being Projected. This does not generally cause problems, since a Linear iModel cannot be very large geographically, and hence the projection "warping" throughout the project extents is negligible, if it is ever applied.

#### The Vertical Coordinate Reference System

The horizontal part of a GCS describes where a point is on the earth, but does not by itself explain what its elevation means. The vertical part, available through [GeographicCRS.verticalCRS]($common), describes the reference surface from which heights are measured. This can be an ellipsoid or a geoid (a surface approximating mean sea level).

Two datasets can use the same horizontal coordinate reference system but different vertical coordinate reference systems. Their features may line up horizontally while appearing at different heights. For example, a point at zero height in `EGM96 height` generally has a nonzero height above the ellipsoid. The difference varies with location, so converting elevations between these systems is not generally equivalent to adding a constant offset.

[Cartographic.height]($common) is a height above the ellipsoid, in meters. It is not a height above mean sea level or above the ground. The vertical CRS is therefore important when converting an iModel's elevations to Cartographic coordinates or positioning other data relative to the iModel.

[VerticalCRS]($common) can identify a predefined vertical system by name using `crsName`, or by a numeric EPSG code using `epsg`. These properties are beta; `crsName` takes precedence when both are supplied. The required `id` property retains the legacy height convention for older readers, which may not reproduce the precise named system. Applications can use the beta backend function [getAvailableVerticalCoordinateReferenceSystems]($backend) to find predefined systems applicable to the project's geographic location.

> Notes about Vertical CRS:

- The vertical CRS should describe the elevations in the source data. Assigning a different CRS to an iModel changes the interpretation of its coordinates; it does not transform the element geometry.
- Like horizontal transformations, vertical transformations can require external data. For offline use, the data needed for the intended conversions must be downloaded in advance. Being able to select a vertical CRS does not guarantee that all data needed to convert its elevations is available.
- Check the [GeoCoordStatus]($common) of a conversion before using its elevation. `VerticalDatumConvertError` means that the horizontal coordinates remain valid, but the elevation could not be fully converted. A zero or unchanged elevation should not be treated as a successful conversion.

## How Geographic Coordinates are used in iTwin.js

For display purposes, Geographic coordinates are only relevant for Spatial views. They are obviously used for showing Cartographic coordinates to users.

They are also used for:

- positioning reality meshes within a spatial view. Reality meshes are displayed with a linear transform that combines the ECEF Location of the iModel with their spatial coordinates.
- positioning maps and other projected GIS information within a spatial view. Note that for projected iModels, if the datum and projection systems are not identical, the map/GIS data is "warped" to match the iModel's GCS.
- positioning spatial views relative to the user's location and orientation via GPS or other location services. For performance reasons, this is done on the front end using ECEF Location, even for projected iModels.
