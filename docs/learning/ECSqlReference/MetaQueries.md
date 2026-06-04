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

Properties can reference a [KindOfQuantity](../ECDbMeta.ecschema.md#kindofquantitydef) (KoQ) through `ECPropertyDef.KindOfQuantity`. A KoQ tells you what kind of quantity a property represents, such as an angle, length, or weight, and records the unit used to persist that value in `KindOfQuantityDef.PersistenceUnit`.

`ECPropertyDef.KindOfQuantity` is a relationship you can join through. `KindOfQuantityDef.PersistenceUnit` is different: it is just stored text such as `"u:M"` or `"u:CUB_M"`. To resolve that text to a [UnitDef](../ECDbMeta.ecschema.md#unitdef), match it against the unit name together with the owning schema alias.

Imagine you are inspecting an EC Schema for a piping domain that contains classes such as `BendType` and `ValveType`, and you want to answer questions such as:

- Is a `BendType.Angle` or `BendType.Radius` value persisted in radians, meters, or some other unit?
- If the property represents a non-spatial value like `ValveType.GrossWeight`, what unit is stored in the database?
- How does the schema suggest the value should be formatted in an application?

The workflow is the same in each case:

1. Find the property and its KoQ.
2. Inspect the KoQ's persistence and presentation settings.
3. Resolve the persistence unit string to a `UnitDef` row for more unit metadata.

The queries below use real BIS class and property names such as `BendType.Angle`, `BendType.Radius`, and `ValveType.GrossWeight`. Replace them with names from your own schema when you apply the same workflow.

#### 1. Find candidate properties and their KindOfQuantity

Start by searching for concrete class and property combinations that match the investigation you have in mind. In public BIS schemas, examples include `BendType.Angle`, `BendType.Radius`, and `ValveType.GrossWeight`:

```sql
SELECT
  c.Name AS ClassName,
  p.Name AS PropertyName,
  koq.Name AS KindOfQuantityName,
  koq.PersistenceUnit
FROM meta.ECPropertyDef p
  JOIN meta.ECClassDef c ON p.Class.Id = c.ECInstanceId
  JOIN meta.KindOfQuantityDef koq ON p.KindOfQuantity.Id = koq.ECInstanceId
WHERE
  (c.Name = 'BendType' AND p.Name = 'Angle')
  OR (c.Name = 'BendType' AND p.Name = 'Radius')
  OR (c.Name = 'ValveType' AND p.Name = 'GrossWeight')
ORDER BY c.Name, p.Name
LIMIT 10
```

Representative result:

```text
ClassName|PropertyName|KindOfQuantityName|PersistenceUnit
---------------------------------------------------------
BendType |Angle       |ANGLE             |u:RAD
BendType |Radius      |LENGTH_SHORT      |u:M
ValveType|GrossWeight |WEIGHT            |u:KG
```

This first result tells you four things: which EC class owns the property (`ClassName`), which property you are inspecting (`PropertyName`), which KoQ is attached to it (`KindOfQuantityName`), and the raw persistence-unit string recorded on that KoQ (`PersistenceUnit`). In other words, this query helps you confirm both *what kind of quantity the property represents* and *how its values are stored* before drilling into formatting and unit metadata.

#### 2. Inspect one property's persistence and presentation settings

Say you want to understand how a bend's angle is stored and how applications are expected to display it. Filter to that one property and inspect the KoQ details:

```sql
SELECT
  koq.Name AS KindOfQuantityName,
  koq.PersistenceUnit,
  koq.RelativeError,
  koq.PresentationUnits
FROM meta.ECClassDef c
  JOIN meta.ECPropertyDef p ON p.Class.Id = c.ECInstanceId
  JOIN meta.KindOfQuantityDef koq ON p.KindOfQuantity.Id = koq.ECInstanceId
WHERE c.Name = 'BendType'
  AND p.Name = 'Angle'
```

Representative result:

```text
KindOfQuantityName|PersistenceUnit|RelativeError|PresentationUnits
---------------------------------------------------------------------------------------------------------------------
ANGLE             |u:RAD          |0.0001       |["f:DefaultRealU(2)[u:ARC_DEG]","f:AngleDMS"]
```

In plain terms, this tells you that `BendType.Angle` is semantically an angle, its value is persisted in radians, and applications are encouraged to format that stored value in more human-friendly forms such as decimal degrees or degrees-minutes-seconds.

The same pattern works for other properties on these real classes. For example, `BendType.Radius` uses `LENGTH_SHORT`, while `ValveType.GrossWeight` uses `WEIGHT`. Related operating-range properties such as `ValveType.PressureRange` and `ValveType.TemperatureRange` live on the same class when you want to inspect non-geometric quantities.

#### 3. Resolve the persistence unit to UnitDef details

Once you know the KoQ's `PersistenceUnit`, resolve it to the corresponding `UnitDef`. This tells you which unit row matched the stored `"alias:Name"` text:

```sql
SELECT
  c.Name AS ClassName,
  p.Name AS PropertyName,
  koq.Name AS KindOfQuantityName,
  koq.PersistenceUnit,
  unit.SchemaAlias AS UnitSchemaAlias,
  unit.UnitName,
  unit.UnitLabel
FROM meta.ECClassDef c
  JOIN meta.ECPropertyDef p ON p.Class.Id = c.ECInstanceId
  JOIN meta.KindOfQuantityDef koq ON p.KindOfQuantity.Id = koq.ECInstanceId
  JOIN (
    SELECT
      u.ECInstanceId,
      s.Alias AS SchemaAlias,
      u.Name AS UnitName,
      u.DisplayLabel AS UnitLabel
    FROM meta.UnitDef u
      JOIN meta.ECSchemaDef s ON s.ECInstanceId = u.Schema.Id
  ) unit
    ON (
      koq.PersistenceUnit = unit.SchemaAlias || ':' || unit.UnitName
      OR koq.PersistenceUnit = unit.UnitName
    )
WHERE c.Name = 'BendType'
  AND p.Name = 'Angle'
```

Representative result:

```text
ClassName|PropertyName|KindOfQuantityName|PersistenceUnit|UnitSchemaAlias|UnitName|UnitLabel
---------------------------------------------------------------------------------------------
BendType |Angle       |ANGLE             |u:RAD          |u              |RAD     |rad
```

The second branch of the join condition handles older data where `PersistenceUnit` may be stored as just `"UnitName"` without the schema alias. If multiple schemas define the same unit name, include the unit schema name in the subquery output to confirm which unit matched.

To go deeper on the BIS concepts behind these query results, see [Physical Units in BIS](../../bis/guide/other-topics/units.md) and [KindOfQuantities in BIS](../../bis/guide/other-topics/kindOfQuantities.md). If you want to understand how applications can parse, format, and present those values after they are read from the schema, see [Quantity Formatting and Parsing](../../quantity-formatting/index.md).

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
