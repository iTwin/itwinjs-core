# Spatial Queries

ECSQL allows you to use the BisCore.SpatialIndex to include spatial criteria when selecting [spatial elements]($imodeljs-backend.SpatialElement). There are also functions that allow you to include an element's geometric properties in a where clause.

The [spatial elements]($imodeljs-backend.SpatialElement) in an iModel are index by a [spatial index](https://sqlite.org/rtree.html). This indexes elements by area. Each node in the spatial index is conceptually a bounding box, plus the ECInstanceId of an element that is enclosed by it.

ECSQL identifies the spatial index using the name `BisCore.SpatialIndex`. You can using this name to include the spatial index in ECSQL select statements, to help filter results using spatial criteria. Conceptually, each node has the following properties: ECInstanceId, MinX, MaxX, MinY, MaxY, MinZ, MaxZ. The nodes in the spatial index can be selected by testing their properties directly. Here is an example that is adapted from the [SQLite docs](https://sqlite.org/rtree.html):

`SELECT ECInstanceId FROM BisCore.SpatialIndex WHERE minX>=-81.08 AND maxX<=-80.58 AND minY>=35.00  AND maxY<=35.44`

Nodes in the spatial index can also be selected using the special `MATCH` keyword and one of the builtin rtree functions. The functions for MATCHing rtree nodes are:
* iModel_spatial_overlap_aabb - select all nodes that overlap a specified [Range3dProps]($geometry-core.Range3dProps)
* iModel_rtree

Here is a simple example of a spatial query using MATCH:

`SELECT rt.ECInstanceId FROM BisCore.SpatialIndex rt WHERE (rt.ECInstanceId MATCH iModel_spatial_overlap_aabb(:bbox))`

The caller would bind the `bbox` parameter in this example to a range.

The MATCH clause acts like a sub-selection in that it generates a set of ECInstanceIds, which it gathers from the nodes that match the specified criteria.

Often, a spatial query will combine a test on the spatial index with additional filtering criteria in the WHERE clause. As noted in the [SQLite docs](https://sqlite.org/rtree.html), "An R*Tree index does not normally provide the exact answer but merely reduces the set of potential answers from millions to dozens." The additional filtering criteria are used to refine the answer after the spatial filter has narrowed the possibilities. For example, to select only elements in the specified range that are also in a specified Category:

`SELECT rt.ECInstanceId FROM BisCore.SpatialIndex rt, BisCore.SpatialElement el WHERE (rt.ECInstanceId MATCH iModel_spatial_overlap_aabb(:bbox)) AND (el.ECInstanceId=rt.ECInstanceId) AND (el.Category = :categoryId)`

*Tip:* The OR operator should not be used in a WHERE clause that contains a spatial index MATCH.

## Geometry Functions

ECSQL has a number of built-in functions that allow you to query on element geometry. The functions are organized here by the kind of object that they operate on.

## [XYZProps]($geometry-core.XYZProps)
A point in the iModel's Cartesian coordinate system. If the point represents a location in a 2D model, then the z-coordinate will be zero. All coordinates are in meters.

Functions:
* iModel_point_value
* iModel_point_distance
* iModel_point_min_distance_to_bbox


## [YawPitchRoll]($geometry-core.YawPitchRoll)
An object that contains Yaw, Pitch, and Roll angles in degrees. If this object represents a rotation in a 2D model, then the pitch and roll members will be zero.

Functions:
* iModel_angles_value
* iModel_angles_maxdiff

## [Range3dProps]($geometry-core.Range3dProps)

An object that defines a range.
If the box represents a range in a 3-D model, then the box will have 8 corners and will have width(X), depth(Y), and height(Z).
If the box represents a range in a 2-D model, then the box will still have 8 corners but the z-coordinates will be all be zero, and the height will be zero.
All coordinates are in meters.

Functions:
* iModel_bbox_value
* iModel_bbox_width
* iModel_bbox_height
* iModel_bbox_depth
* iModel_bbox_volume
* iModel_bbox_areaxy
* iModel_bbox_overlaps
* iModel_bbox_contains
* iModel_bbox_union
* iModel_point_min_distance_to_bbox

## [Placement3dProps]($geometry-core.Placement3dProps)
An object that contains an origin and rotation angles, plus a bounding box.
You can obtain an element's placement by selecting the placement column of the ElementGeom table.

Functions:
* iModel_placement_origin
* iModel_placement_angles
* iModel_placement_eabb
* iModel_placement_aabb
