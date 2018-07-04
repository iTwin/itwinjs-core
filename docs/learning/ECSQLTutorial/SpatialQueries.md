# Spatial Queries

Every instance of the `SpatialElement` ECClass in an iModel is spatially indexed. The spatial index allows fast look-ups by spatial criteria. Each row in the spatial index is conceptually a bounding cube, plus the ECInstanceId of an element that is enclosed by it.

The index is exposed to ECSQL via the ECClass [BisCore.SpatialIndex](../../bis/domains/biscore/BisCore.ecschema.md#SpatialIndex). See [ECSQL Reference](../SpatialQueries.md) for details.

> **Try it yourself**
>
> *Goal:* Return all [SpatialElement](../../bis/domains/biscore/BisCore.ecschema.md#SpatialElement)s that are contained or overlap a cube defined by the minimum coordinate (0|0|0) and maximum coordinate (10|10|10).
>
> *ECSQL*
> ```sql
> SELECT e.ECInstanceId, e.CodeValue FROM bis.SpatialElement e JOIN bis.SpatialIndex i ON e.ECInstanceId=i.ECInstanceId WHERE i.MinX<=10 AND i.MinY<=10 AND i.MinZ<=10 AND i.MaxX>=0 AND i.MaxY>=0 AND i.MaxZ>=0
> ```
>
> *Result*
>
> ECInstanceId | CodeValue
> --- | ---
> 0x10000000012 | Building A
> 0x10000000021 | DEV-A-G-1
> 0x10000000022 | DEV-A-G-2
> 0x10000000023 | DEV-A-1-1
> 0x10000000014 | A-G-1
> 0x10000000015 | A-G-2
> 0x10000000017 | A-1-1
> 0x10000000013 | A-G
> 0x10000000016 | A-1

For more complex spatial criteria the `MATCH` keyword together with the special built-in spatial index matching function `iModel_spatial_overlap_aabb` is used. The MATCH clause acts like a sub-selection that generates a set of ECInstanceIds, which it gathers from the spatial index rows that match the specified criteria.
The function `iModel_spatial_overlap_aabb` selects all nodes that overlap a specified axis-aligned [bounding box](../GeometrySqlFuncs.md#iModel_bbox).

See also other [ECSQL built-in geometry functions](../GeometrySqlFuncs.md) which can be used along with spatial queries as additional WHERE criteria.

> **Try it yourself**
> The argument to the match function can only be passed via an ECSQL parameter. As the iModelConsole does not support parameter values, the following example cannot be tried out with the iModelConsole. You would have to put the sample code into your own playground.
>
> *Goal:* Return all [SpatialElement](../../bis/domains/biscore/BisCore.ecschema.md#SpatialElement)s that overlap the [SpatialElement](../../bis/domains/biscore/BisCore.ecschema.md#SpatialElement) with id 444 and are in the Category with id 333.
>
> *ECSQL*
> ```sql
> SELECT e.ECInstanceId, e.CodeValue FROM bis.SpatialElement e JOIN bis.SpatialIndex i ON e.ECInstanceId=i.ECInstanceId WHERE i.ECInstanceId MATCH iModel_spatial_overlap_aabb(?) AND e.Category.Id=333
> ```
> *Sample code*
> ```ts
> const element444: SpatialElement = iModelDb.elements.getElement(444) as SpatialElement;
>
> iModelDb.withPreparedStatement("SELECT e.ECInstanceId, e.CodeValue FROM bis.SpatialElement e JOIN bis.SpatialIndex i ON e.ECInstanceId=i.ECInstanceId WHERE i.ECInstanceId MATCH iModel_spatial_overlap_aabb(?) AND e.Category.Id=333",
>    (stmt: ECSqlStatement) => {
>    stmt.bindRange3d(1, element444.placement.calculateRange());
>    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
>       const row: any = stmt.getRow();
>       console.log(row);
>    }
> });
>```
>
> *Result*
> ```ts
> { id : 10, codeValue: "hhh" }
> { id : 11, codeValue: "fff" }
> ```

---

[**< Previous**](./PolymorphicQueries.md) &nbsp; | &nbsp; [**Next >**](./MetaQueries.md)