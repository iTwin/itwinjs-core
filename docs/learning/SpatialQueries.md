# Spatial Queries

ECSQL allows you to use the BisCore.SpatialIndex to include spatial criteria when selecting [spatial elements]($imodeljs-backend.SpatialElement). There are also [built-in geometry functions](./SqlFuncs.md) that allow you to include an element's geometric properties in a where clause.

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

@see [ECSQL Built-in Geometry Functions](./SqlFuncs.md)