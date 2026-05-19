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
