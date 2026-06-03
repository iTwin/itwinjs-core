# Meta Queries

The `ECDbMeta` schema allows querying schema information from an ECDb.

> For a runtime-optimized object-model alternative that loads a curated subset of schema metadata in one shot for traversal and repeated lookups, see [SchemaView](../metadata/SchemaView.md).

### Schemas in a file

A list of schemas inside an ECDb can be obtained by:

```sql
Select Name from meta.ECSchemaDef
```

Example result:

```
Name
--------------------
CoreCustomAttributes
ECDbFileInfo
ECDbMap
ECDbMeta
ECDbSystem
TestSchema

[Executed in 0.0707 s]
```

### Querying KindOfQuantity and Units

Properties can reference a [KindOfQuantity](../ECDbMeta.ecschema.md#kindofquantitydef) (KoQ) through the `ECPropertyDef.KindOfQuantity` navigation property. A KoQ defines the physical quantity a property measures (e.g. length, area, angle) and carries the unit in which values are persisted (`PersistenceUnit`) as well as optional presentation format overrides (`PresentationUnits`).

`PersistenceUnit` is stored as a plain string in `"schemaAlias:UnitName"` format (e.g. `"u:SQ_M"`) or, in older data, just `"UnitName"`. To resolve this to a [UnitDef](../ECDbMeta.ecschema.md#unitdef) row you join `meta.UnitDef` and `meta.ECSchemaDef` (for the unit's owning schema alias).

#### List properties and their KindOfQuantity

The simplest form – get every property that has a KoQ together with the KoQ name and raw persistence-unit string:

```sql
SELECT
  c.Name AS ClassName,
  p.Name AS PropertyName,
  koq.Name AS KindOfQuantityName,
  koq.PersistenceUnit
FROM meta.ECPropertyDef p
  JOIN meta.ECClassDef c ON p.Class.Id = c.ECInstanceId
  JOIN meta.KindOfQuantityDef koq ON p.KindOfQuantity.Id = koq.ECInstanceId
ORDER BY c.Name, p.Name
LIMIT 10
```

#### Get the persistence unit for a specific property

Filter the query to a single class and property to inspect its KoQ and persistence unit:

```sql
SELECT
  koq.Name AS KindOfQuantityName,
  koq.PersistenceUnit,
  koq.RelativeError,
  koq.PresentationUnits
FROM meta.ECClassDef c
  JOIN meta.ECPropertyDef p ON p.Class.Id = c.ECInstanceId
  JOIN meta.KindOfQuantityDef koq ON p.KindOfQuantity.Id = koq.ECInstanceId
WHERE c.Name = 'PhysicalElement'
  AND p.Name = 'Yaw'
```

#### Resolve the persistence unit to full UnitDef details

Join `meta.UnitDef` and the unit's owning `meta.ECSchemaDef` to decode the `"alias:Name"` string stored in `PersistenceUnit`:

```sql
SELECT
  c.Name AS ClassName,
  p.Name AS PropertyName,
  koq.Name AS KindOfQuantityName,
  u.Name AS UnitName,
  u.DisplayLabel AS UnitLabel
FROM meta.ECClassDef c
  JOIN meta.ECPropertyDef p ON p.Class.Id = c.ECInstanceId
  JOIN meta.KindOfQuantityDef koq ON p.KindOfQuantity.Id = koq.ECInstanceId
  JOIN meta.UnitDef u ON TRUE
  JOIN meta.ECSchemaDef us ON us.ECInstanceId = u.Schema.Id
WHERE
  (
    koq.PersistenceUnit = us.Alias || ':' || u.Name
    OR koq.PersistenceUnit = u.Name
  )
  AND c.Name = 'ArcWall'
  AND p.Name = 'HOST_AREA_COMPUTED'
```

The two-part `WHERE` condition handles both the modern alias-prefixed format (`"u:SQ_M"`) and the legacy unprefixed format (`"SQ_M"`). Add a `LIMIT` or narrow the class/property filter when running against large iModels.

#### List all KindOfQuantity definitions with resolved unit details

Inspect all KoQs together with the unit name, unit system, and phenomenon:

```sql
SELECT
  s.Name AS KoQSchema,
  koq.Name AS KindOfQuantityName,
  u.Name AS UnitName,
  u.DisplayLabel AS UnitLabel,
  us.Name AS UnitSystemName
FROM meta.KindOfQuantityDef koq
  JOIN meta.ECSchemaDef s ON s.ECInstanceId = koq.Schema.Id
  JOIN meta.UnitDef u ON TRUE
  JOIN meta.ECSchemaDef us ON us.ECInstanceId = u.Schema.Id
WHERE
  (
    koq.PersistenceUnit = us.Alias || ':' || u.Name
    OR koq.PersistenceUnit = u.Name
  )
ORDER BY s.Name, koq.Name
```

### Examples on how to query for custom attributes

Obtaining values from inside a custom attribute can be achieved using json_extract.
This example shows how to obtain the MapStrategy on BisCore:Element

```xml
<!-- Piece inside the BisCore schema on the element class -->
            <ClassMap xmlns="ECDbMap.2.0.2">
                <MapStrategy>TablePerHierarchy</MapStrategy>
            </ClassMap>
```

```sql
SELECT ec_classname(ca.Class.Id) [Class], json_extract(ca.Instance, '$.ClassMap.MapStrategy') [MapStrategy]
   FROM meta.ClassCustomAttribute ca
   WHERE ca.CustomAttributeClass.Id IS (ecdbmap.ClassMap) AND ca.Class.Id IS (ONLY bis.Element) LIMIT 5;
```

Result

```
Class               |MapStrategy
-----------------------------------------
BisCore:Element     |TablePerHierarchy
```

[ECSql Syntax](./index.md)
