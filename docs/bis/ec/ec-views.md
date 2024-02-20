# ECViews

A view is a special kind of [ECEntityClass](ec-entity-class.md). The concept is realized through an [ECCustomAttribute](ec-custom-attributes.md) which is defined in the `ECDbMap` schema.

The custom attribute allows defining an abstract entity class which is not backed by actual data but rather by an ECSQL query which is executed to obtain instances of the class.

The following rules apply to views:

- The custom attribute `ECDbMap.View` must be applied to a standalone abstract entity class.
- View cannot be derived from another class
- View class definition cannot have derived classes.
- All columns selected in the ECSQL query except for ECInstanceId must have corresponding ECProperties defined on the class.
- Query column type and property type have to match (int for integers, string for strings etc.).
- The query has to return an ECInstanceId column
- The query may return an ECClassId column, if it does not, the class id of the abstract class is automatically being used.
- All types of properties and computed expressions can be returned by view query if the class definition defines those properties and their types correctly.
- Views can be applied only to the ECEntityClass or ECRelationshipClass.
- For relationship classes, a different custom attribute `ECDbMap.ImplicitView` can be used instead, which will make the runtime go and check both sides for a navigation property which matches the relationship. If one is found, a view for the relationship is automatically generated.
- Support for relationship views other than ImplicitView is currently limited. Using it for linktable relationships is not currently allowed.
- Any metadata like property category or kind of quantity is taken from the property definitions. Metadata that may come from the view query is overridden by these.

Example of a schema using a view:

```xml
<ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
    <ECSchemaReference name='ECDbMap' version='02.00.03' alias='ecdbmap' />
    <ECEntityClass typeName="JsonObject">
        <ECProperty propertyName="json" typeName="string" extendedTypeName="Json" />
    </ECEntityClass>
    <ECEntityClass typeName="Pipe" modifier="Abstract">
        <ECCustomAttributes>
            <View xmlns="ECDbMap.02.00.03">
                <Query>
                    SELECT
                        jo.ECInstanceId,
                        CAST(json_extract(jo.json, '$.diameter') AS INTEGER) [Diameter],
                        CAST(json_extract(jo.json, '$.length') AS INTEGER) [Length],
                        json_extract(jo.json, '$.material') [Material]
                    FROM ts.JsonObject jo
                    WHERE json_extract(jo.json, '$.type') = 'pipe'
                </Query>
            </View>
        </ECCustomAttributes>
        <ECProperty propertyName="Diameter" typeName="int" />
        <ECProperty propertyName="Length"  typeName="int"/>
        <ECProperty propertyName="Material" typeName="string" />
    </ECEntityClass>
</ECSchema>
```

`JsonObject` could be filled with this data:

```
{"type": "pipe", "diameter": 10, "length": 100, "material": "steel"}
{"type": "pipe", "diameter": 15, "length": 200, "material": "copper"}
{"type": "pipe", "diameter": 20, "length": 150, "material": "plastic"}
{"type": "cable", "diameter": 5, "length": 500, "material": "copper","type": "coaxial"}
{"type": "cable", "diameter": 2, "length": 1000, "material": "fiber optic","type": "single-mode"}
{"type": "cable", "diameter": 3, "length": 750, "material": "aluminum","type": "twisted pair"}
```

Running this query:

```sql
SELECT Length, Diameter, Material FROM ts.Pipe
```

Will return this result:

```
Length   |Diameter |Material
----------------------------------------
100      |10       |steel
200      |15       |copper
150      |20       |plastic
```

A view may contain navigation properties, for these, the query can use the `navigation_value`function provided by ECSQL [ECSqlFunctions](./../../learning/ECSqlReference/ECSqlFunctions.md)
