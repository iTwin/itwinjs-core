# Meta Queries - Querying ECSchemas

Every iModel includes the [ECDbMeta](../ECDbMeta.ecschema.md) ECSchema. It exposes the content of all schemas that the iModel contains. You can therefore use ECSQL against that schema to query for schemas, classes, properties etc.

> **Try it yourself**
>
> _Goal:_ Return the name, alias and version of all [schemas](../ECDbMeta.ecschema.md#ecschemadef) in the iModel
>
> _ECSQL_
>
> ```sql
> SELECT Name, Alias, VersionMajor, VersionWrite, VersionMinor FROM meta.ECSchemaDef ORDER BY Name
> ```

---

> **Try it yourself**
>
> _Goal:_ Return the properties and their types for the [Element](../../bis/domains/BisCore.ecschema.md#element) class
>
> _ECSQL_
>
> ```sql
> SELECT p.Name from meta.ECPropertyDef p JOIN meta.ECClassDef c ON c.ECInstanceId=p.Class.Id WHERE c.Name='Element' ORDER BY p.Ordinal
> ```

Note the `ORDER BY` clause in the previous example. The property `Ordinal` of the [ECPropertyDef](../ECDbMeta.ecschema.md#ecpropertydef) class contains the position of the property in the class as it was originally defined.

Another advantage of accessing the schemas via ECSQL is that you can combine that with ordinary ECSQL queries. The next examples shows how you can do that.

> **Try it yourself**
>
> _Goal:_ Return only [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement)s in the iModel which are of the subclass 'PhysicalObject' or 'LightLocation'.
>
> _ECSQL_
>
> ```sql
> SELECT class.Name ClassName, element.ECInstanceId ElementId, element.UserLabel FROM bis.SpatialElement element JOIN meta.ECClassDef class ON element.ECClassId=class.ECInstanceId WHERE class.Name IN ('PhysicalObject','LightLocation')
> ```

Of course, the ECSQL is not precise yet because the class names are only unique within a schema. If there
were a `Building` subclass in another schema, those instances would also be returned. This requires to bring in the [ECSchemaDef](../ECDbMeta.ecschema.md#ecschemadef) class again.

> **Try it yourself**
>
> _Goal:_ Return only [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement)s in the iModel which are of the subclass 'PhysicalObject' from the schema 'Generic'.
>
> _ECSQL_
>
> ```sql
> SELECT class.Name ClassName, element.ECInstanceId ElementId, element.UserLabel FROM bis.SpatialElement element JOIN meta.ECClassDef class ON element.ECClassId=class.ECInstanceId JOIN meta.ECSchemaDef schema ON schema.ECInstanceId=class.Schema.Id WHERE schema.Name = 'Generic' AND class.Name IN ('PhysicalObject')
> ```

---

[< Previous](./SpatialQueries.md) &nbsp; | &nbsp; [Next >](./ChangeSummaryQueries.md)
