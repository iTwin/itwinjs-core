# Spatial Queries

Every instance of the [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement) ECClass in an iModel is spatially indexed. The spatial index allows fast look-ups by spatial criteria. Each row in the spatial index is conceptually a bounding cube, plus the ECInstanceId of an element that is enclosed by it.

The index is exposed to ECSQL via the ECClass [BisCore.SpatialIndex](../../bis/domains/BisCore.ecschema.md#spatialindex). See [ECSQL Reference](../SpatialQueries.md) for details.

> **Try it yourself**
>
> *Goal:* Return all [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement)s that are contained or overlap a cube defined by the minimum coordinate (0, 0, 0) and maximum coordinate (415|120|15).
>
> *ECSQL*
>
> ```sql
> SELECT e.ECInstanceId, e.UserLabel, i.MinX, i.MinY, i.MinZ, i.MaxX, i.MaxY, i.MaxZ FROM bis.SpatialElement e JOIN bis.SpatialIndex i ON e.ECInstanceId=i.ECInstanceId WHERE i.MinX<=415 AND i.MinY<=120 AND i.MinZ<=15 AND i.MaxX >= 0 AND i.MaxY >= 0 AND i.MaxZ >= 0
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT e.ECInstanceId, e.UserLabel, i.MinX, i.MinY, i.MinZ, i.MaxX, i.MaxY, i.MaxZ FROM bis.SpatialElement e JOIN bis.SpatialIndex i ON e.ECInstanceId=i.ECInstanceId WHERE i.MinX<=415 AND i.MinY<=120 AND i.MinZ<=15 AND i.MaxX >= 0 AND i.MaxY >= 0 AND i.MaxZ >= 0"></iframe>

For more complex spatial criteria the `MATCH` keyword together with the special built-in spatial index matching function `iModel_spatial_overlap_aabb` is used. The MATCH clause acts like a sub-selection that generates a set of ECInstanceIds, which it gathers from the spatial index rows that match the specified criteria.
The function `iModel_spatial_overlap_aabb` selects all nodes that overlap a specified axis-aligned [bounding box](../GeometrySqlFuncs.md#imodel_bbox).

See also other [ECSQL built-in geometry functions](../GeometrySqlFuncs.md) which can be used along with spatial queries as additional WHERE criteria.

> **Try it yourself**
> The argument to the match function can only be passed via an ECSQL parameter. As the iModelConsole does not support parameter values, the following example cannot be tried out with the iModelConsole. You would have to put the sample code into your own playground.
>
> *Goal:* Return all [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement)s which overlap the [Space](./MyDomain.ecschema.md#space) with id 0x1000000001f and which are in the [Category](../../bis/domains/BisCore.ecschema.md#category) with id 0x1000000000a.
>
> *ECSQL*
>
> ```sql
> SELECT e.ECInstanceId, e.CodeValue FROM bis.SpatialElement e JOIN bis.SpatialIndex i ON e.ECInstanceId=i.ECInstanceId WHERE i.ECInstanceId MATCH iModel_spatial_overlap_aabb(?) AND e.Category.Id=0x1000000000a
> ```
>
> *Sample code*
>
> ```ts
> const spaceElement: SpatialElement = iModelDb.elements.getElement("0x1000000001f") as SpatialElement;
>
> iModelDb.withPreparedStatement("SELECT e.ECInstanceId, e.ECClassId, e.CodeValue FROM bis.SpatialElement e JOIN bis.SpatialIndex i ON e.ECInstanceId=i.ECInstanceId WHERE i.ECInstanceId MATCH iModel_spatial_overlap_aabb(?) AND e.Category.Id=0x1000000000a",
>    (stmt: ECSqlStatement) => {
>      stmt.bindRange3d(1, spaceElement.placement.calculateRange());
>      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
>         const row: any = stmt.getRow();
>         console.log(row);
>      }
>    });
>```
>
> *Result*
>
> ```ts
> { id : "0x1000000001e", className: "MyDomain.Story", codeValue: "A-G" }
> { id : "0x10000000023", className: "MyDomain.Story", codeValue: "A-1" }
> ```

---

[**< Previous**](./PolymorphicQueries.md) &nbsp; | &nbsp; [**Next >**](./MetaQueries.md)
