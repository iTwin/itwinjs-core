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

Properties can reference a [KindOfQuantity](../ECDbMeta.ecschema.md#kindofquantitydef) (KoQ) through the `ECPropertyDef.KindOfQuantity` navigation property. A KoQ describes the physical quantity a property measures and stores its persistence unit in `KindOfQuantityDef.PersistenceUnit`.

Unlike `ECPropertyDef.KindOfQuantity`, `KindOfQuantityDef.PersistenceUnit` is not a navigation property. It is stored as a string such as `"u:M"` or `"u:CUB_M"`, so resolving it to a [UnitDef](../ECDbMeta.ecschema.md#unitdef) requires matching that string against the unit name together with the owning schema alias.

The queries below use representative results. Your class, property, and unit names will vary in other datasets.

#### List properties that have a KindOfQuantity

Start by listing properties whose `KindOfQuantity` navigation property is set:

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

Example result:

```
ClassName                        |PropertyName                     |KindOfQuantityName|PersistenceUnit
------------------------------------------------------------------------------------------------------
AggregateMeshSurfaceEntityAspect |MeshSurfaceEntity_CivilVolume    |VOLUME            |u:CUB_M
AggregateMeshSurfaceEntityAspect |MeshSurfaceEntity_EndStationFormatted|STATION       |u:M
AggregateMeshSurfaceEntityAspect |MeshSurfaceEntity_StartStationFormatted|STATION     |u:M
AirValve_PhysicalAspect          |Physical_AirValveElevation       |ELEVATION         |u:M
AirValveAspect                   |BaselineOffsetSetOut             |LENGTH            |u:M
AirValveAspect                   |BaselineStationSetOut            |STATION           |u:M
AirValveAspect                   |FormationElevation               |LENGTH            |u:M
Alignment                        |LengthValue                      |LENGTH            |u:M
Alignment                        |StartStation                     |STATION           |u:M
Alignment                        |StartValue                       |LENGTH            |u:M
```

#### Inspect the KindOfQuantity for one property

Once you find a property of interest, filter to that class and property to inspect the KoQ details:

```sql
SELECT
  koq.Name AS KindOfQuantityName,
  koq.PersistenceUnit,
  koq.RelativeError,
  koq.PresentationUnits
FROM meta.ECClassDef c
  JOIN meta.ECPropertyDef p ON p.Class.Id = c.ECInstanceId
  JOIN meta.KindOfQuantityDef koq ON p.KindOfQuantity.Id = koq.ECInstanceId
WHERE c.Name = 'Alignment'
  AND p.Name = 'LengthValue'
```

Example result:

```
KindOfQuantityName|PersistenceUnit|RelativeError|PresentationUnits
------------------------------------------------------------------------------------------------------------------------------------
LENGTH            |u:M            |0.0001       |["f:DefaultRealU(2)[u:M]","f:DefaultRealU(2)[u:FT]","f:DefaultRealU(2)[u:US_SURVEY_FT]"]
```

#### Resolve the persistence unit to UnitDef details

To resolve `PersistenceUnit` to the corresponding `UnitDef`, first pair each unit with its owning schema alias, then match that `"alias:Name"` text to the KoQ's stored `PersistenceUnit` string:

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
WHERE c.Name = 'Alignment'
  AND p.Name = 'LengthValue'
```

Example result:

```
ClassName|PropertyName|KindOfQuantityName|PersistenceUnit|UnitSchemaAlias|UnitName|UnitLabel
----------------------------------------------------------------------------------------------
Alignment|LengthValue |LENGTH            |u:M            |u              |M       |m
```

The second branch of the join condition handles older data where `PersistenceUnit` may be stored as just `"UnitName"` without the schema alias. If multiple schemas define the same unit name, include the unit schema name in the subquery output to confirm which unit matched.

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
