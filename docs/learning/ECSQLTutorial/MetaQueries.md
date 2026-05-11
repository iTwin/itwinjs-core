# Meta Queries - Querying ECSchemas

Every iModel includes the [ECDbMeta](../ECDbMeta.ecschema.md) ECSchema. It exposes the content of all schemas that the iModel contains. You can therefore use ECSQL against that schema to query for schemas, classes, properties etc.

## Schema discovery workflow

When working with an unfamiliar iModel, you typically explore it in three steps:

1. **What schemas exist?** — Query [ECSchemaDef](../ECDbMeta.ecschema.md#ecschemadef) to list all schemas in the iModel.
2. **What classes does a schema have?** — Query [ECClassDef](../ECDbMeta.ecschema.md#ecclassdef) joined to `ECSchemaDef` via `Schema.Id` to list entity, relationship, and struct classes.
3. **What properties does a class have?** — Query [ECPropertyDef](../ECDbMeta.ecschema.md#ecpropertydef) joined to `ECClassDef` via `Class.Id` to inspect property names, types, and order.

The examples below walk through each of these steps.

### Step 1: List schemas

> **Try it yourself**
>
> _Goal:_ Return the name, alias and version of all [schemas](../ECDbMeta.ecschema.md#ecschemadef) in the iModel
>
> _ECSQL_
>
> ```sql
> SELECT Name, Alias, VersionMajor, VersionWrite, VersionMinor FROM meta.ECSchemaDef ORDER BY Name
> ```

### Step 2: List classes in a schema

> **Try it yourself**
>
> _Goal:_ Return all classes in the `Generic` schema with their [type](../ECDbMeta.ecschema.md#ecclasstype) (Entity, Relationship, Struct, or CustomAttribute)
>
> _ECSQL_
>
> ```sql
> SELECT c.Name, c.Type FROM meta.ECClassDef c JOIN meta.ECSchemaDef s ON s.ECInstanceId = c.Schema.Id WHERE s.Name = 'Generic' ORDER BY c.Name
> ```

You can also filter by class type. For example, to see only entity classes, add `AND c.Type = 0` to the `WHERE` clause. See [ECClassType](../ECDbMeta.ecschema.md#ecclasstype) for the full list of type values.

### Step 3: List properties of a class

> **Try it yourself**
>
> _Goal:_ Return the properties of the [Element](../../bis/domains/BisCore.ecschema.md#element) class in their original definition order
>
> _ECSQL_
>
> ```sql
> SELECT p.Name, p.Description FROM meta.ECPropertyDef p JOIN meta.ECClassDef c ON c.ECInstanceId = p.Class.Id WHERE c.Name = 'Element' ORDER BY p.Ordinal
> ```

Note the `ORDER BY` clause in the previous example. The property `Ordinal` of the [ECPropertyDef](../ECDbMeta.ecschema.md#ecpropertydef) class contains the position of the property in the class as it was originally defined.

For a more detailed view, you can also return each property's kind and primitive type:

> **Try it yourself**
>
> _Goal:_ Return the properties of the `BisCore:Element` class with their [kind](../ECDbMeta.ecschema.md#ecpropertykind) (Primitive, Struct, Navigation, etc.) and [primitive type](../ECDbMeta.ecschema.md#primitivetype)
>
> _ECSQL_
>
> ```sql
> SELECT p.Name, p.Description, p.Kind, p.PrimitiveType, p.ExtendedTypeName FROM meta.ECPropertyDef p JOIN meta.ECClassDef c ON c.ECInstanceId = p.Class.Id JOIN meta.ECSchemaDef s ON s.ECInstanceId = c.Schema.Id WHERE s.Name = 'BisCore' AND c.Name = 'Element' ORDER BY p.Ordinal
> ```

The schema-qualified filter (`s.Name = 'BisCore' AND c.Name = 'Element'`) ensures you get the exact class even if another schema defines a class with the same name.

---

## Combining meta queries with data queries

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

## See also

- [ECDbMeta ECSchema reference](../ECDbMeta.ecschema.md) — full documentation of all meta schema classes, relationships, and enumerations.
- [Common Table Expressions](../CommonTableExp.md) — includes a recursive CTE example that uses `meta.ClassHasBaseClasses` to traverse a class inheritance hierarchy.

---

[< Previous](./SpatialQueries.md) &nbsp; | &nbsp; [Next >](./ChangeSummaryQueries.md)
