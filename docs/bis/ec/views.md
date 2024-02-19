# Views

It is possible to define an abstract class with a custom attribute `ECDbMap.View`, in which it is possible to provide an ECSql query.

Some things need to be considered:

- Query property and type should match the view class definition.
- System properties (ECInstanceId, ECClassId).
- If the view query does not return system properties, then the view class will not have it. `SELECT * FROM ts.ViewClass` will only return data properties.
- All types of properties and computed expressions can be returned by view query if the class definition defines those properties and their types correctly.
- Views can be applied only to the ECEntityClass or ECRelationshipClass. If it is applied to ECRelationshipClass, then source and target classes must be view classes as well.
- View classes must be mapped to a virtual table and not a physical table.
- View ECCustomAttribute must be applied to an `Abstract` class.
- View cannot be derived from another class
- View class definition cannot have derived classes.

For example, let's have a look at this schema:

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

And `JsonObject` is filled with this data:

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