# Spatial Queries

[ECSQL](./ECSQL.md) allows you to use the BisCore.SpatialIndex to include spatial criteria when selecting [SpatialElement]($backend). There are also [functions](./GeometrySqlFuncs.md) that allow you to include an element's geometric properties in a where clause.

The [SpatialElement]($backend) in an iModel are indexed by a [spatial index](https://sqlite.org/rtree.html). This indexes elements by area. Each node in the spatial index is conceptually a bounding box, plus the ECInstanceId of an element that is enclosed by it.

ECSQL identifies the spatial index using the name `BisCore.SpatialIndex`. You can use this name to include the spatial index in ECSQL select statements, to help filter results using spatial criteria. Conceptually, each node has the following properties: ECInstanceId, MinX, MaxX, MinY, MaxY, MinZ, and MaxZ. The nodes in the spatial index can be selected by testing their properties directly. Here is an example that is adapted from the [SQLite docs](https://sqlite.org/rtree.html):

```sql
SELECT ECInstanceId FROM BisCore.SpatialIndex WHERE minX>=-81.08 AND maxX<=-80.58 AND minY>=35.00  AND maxY<=35.44
```

Nodes in the spatial index can also be selected using the special `MATCH` keyword and the special builtin spatial index matching function. The MATCH clause acts like a sub-selection that generates a set of ECInstanceIds, which it gathers from the nodes that match the specified criteria.The matching function is:

```sql
iModel_spatial_overlap_aabb(bbox)
```

which selects all nodes that overlap a specified axis-aligned [bounding box](./GeometrySqlFuncs.md#iModel_bbox). Here is an example:

```sql
SELECT rt.ECInstanceId FROM BisCore.SpatialIndex rt WHERE (rt.ECInstanceId MATCH iModel_spatial_overlap_aabb(:bbox))
```

The caller would bind the `bbox` parameter in this example to an [iModel_bbox](./GeometrySqlFuncs.md#iModel_bbox) value. For example:

``` ts
[[include:ECSqlStatement.spatialQuery]]
```

This example shows how to find all elements with ranges that (may) overlap the range of some seed element. Note how the bbox parameter is bound to the range of the seed element. The additional test in the WHERE filters out the seed element, so that only other overlapping elements are found.

Often, a spatial query will combine a test on the spatial index with additional filtering criteria in the WHERE clause. As noted in the [SQLite docs](https://sqlite.org/rtree.html), "An R*Tree index does not normally provide the exact answer but merely reduces the set of potential answers from millions to dozens." The additional filtering criteria are used to refine the answer after the spatial filter has narrowed the possibilities. For example, to select only elements in the specified range that are also in a specified Category:

````sql
SELECT rt.ECInstanceId FROM BisCore.SpatialIndex rt, BisCore.SpatialElement el WHERE (rt.ECInstanceId MATCH iModel_spatial_overlap_aabb(:bbox)) AND (el.ECInstanceId=rt.ECInstanceId) AND (el.Category = :categoryId)
```

*Tip:* The OR operator should not be used in a WHERE clause that contains a spatial index MATCH.

The [ECSQL built-in geometry functions](./GeometrySqlFuncs.md) are sometimes used along with spatial queries as additional WHERE criteria.