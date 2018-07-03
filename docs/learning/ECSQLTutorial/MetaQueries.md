# Meta Queries - Querying ECSchemas

Every iModel includes the [ECDbMeta](../ECDbMeta.ecschema.md) ECSchema. It exposes the content of all schemas that the iModel contains. You can therefore use ECSQL against that schema to query for schemas, classes, properties etc.

> **Try it yourself**
>
> *Goal:* Return the name, alias and version of all schemas in the iModel
>
> *ECSQL*
> ```sql
> SELECT Name, Alias, VersionMajor, VersionWrite, VersionMinor FROM meta.ECSchemaDef ORDER BY Name
> ```
> *Result*
>
> Name | Alias | VersionMajor | VersionWrite | VersionMinor
> --- | --- | --- | --- | ---
> BisCore | bis | 1 | 0 | 0
> CoreCustomAttributes | CoreCA | 1 | 0 | 0
> ECDbFileInfo | ecdbf | 2 | 0 | 0
> ECDbMap | ecdbmap | 2 | 0 | 0
> ECDbMeta | meta | 4 | 0 | 0
> ECDbSchemaPolicies | ecdbpol | 1 | 0 | 0
> ECDbSystem | ecdbsys | 5 | 0 | 0
> Generic |generic | 1 | 0 | 0

---

> **Try it yourself**
>
> *Goal:* Return the properties and their types for the Element class
>
> *ECSQL*
> ```sql
> SELECT p.Name from meta.ECPropertyDef p JOIN meta.ECClassDef c ON c.ECInstanceId=p.Class.Id WHERE c.Name='Element' ORDER BY p.Ordinal
> ```
>
> *Result*
>
> Name |
> --- |
> Model |
> LastMod |
> CodeSpec |
> CodeScope |
> CodeValue |
> UserLabel |
> Parent |
> FederationGuid |
> JsonProperties |

Note the `ORDER BY` clause in the previous example. The property `Ordinal` of the `ECPropertyDef` class contains the position of the property in the class as it was originally defined.

Another advantage of accessing the schemas via ECSQL is that you can combine that with ordinary ECSQL queries. The next examples shows how you can do that.

> **Try it yourself**
>
> *Goal:* Return the sub class names of all Elements in the iModel.
>
> *ECSQL*
> ```sql
> SELECT element.ECInstanceId ElementId, class.Name ClassName FROM bis.Element element JOIN meta.ECClassDef class ON element.ECClassId=class.ECInstanceId
> ```
>
> *Result*
>
> ElementId | ClassName
> --- | ---
> 1 | AnnotationElement2d
> 2 | AnnotationElement2d
> 3 | DrawingCategory
> 4 | PhysicalObject

Of course, the ECSQL is not precise yet because you would usually want to know the schema name for the classes as well, because a class with the same name can exist in more than one schema. This requires to bring in the `ECSchemaDef` class again.

> **Try it yourself**
>
> *Goal:* Return the fully qualified names of the sub classes of all Elements in the iModel.
>
> *ECSQL*
> ```sql
> SELECT element.ECInstanceId ElementId, schema.Name SchemaName, class.Name ClassName FROM bis.Element element JOIN meta.ECClassDef class ON element.ECClassId=class.ECInstanceId JOIN meta.ECSchemaDef schema ON schema.ECInstanceId=class.Schema.Id
> ```
>
> *Result*
>
> ElementId | SchemaName | ClassName
> --- | --- | ---
> 1 | BisCore | AnnotationElement2d
> 2 | BisCore | AnnotationElement2d
> 3 | BisCore | DrawingCategory
> 4 | Gemeric | PhysicalObject

---

[**< Previous**](./SpatialQueries.md) &nbsp; | &nbsp; [**Next >**](./ChangeSummaryQueries.md)