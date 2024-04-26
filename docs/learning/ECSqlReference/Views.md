# ECViews

Allows defining an abstract entity class which is not backed by actual data but rather by an ECSql query which is executed to obtain instances of the class.
The class is flagged with a custom attribute that is declared in the `ECDbMap` schema and holds the view query ECSql.

The following rules apply to views:

- The custom attribute `ECDbMap.View` must be applied to a standalone abstract entity class.
- View cannot be derived from another class
- View class definition cannot have derived classes.
- All columns selected in the ECSQL query except for ECInstanceId and ECClassId must have corresponding ECProperties defined on the class.
- Query column type and property type have to match (int for integers, string for strings etc.).
- The query has to return an ECInstanceId and an ECClassId column
- All types of properties and computed expressions can be returned by view query if the class definition defines those properties and their types correctly.
- Views can be applied only an ECEntityClass.
- For relationship classes, a different custom attribute `ECDbMap.ForeignKeyBasedView` can be used instead, which will make the runtime check both sides for a navigation property matching the relationship. If one is found, a view for the relationship is automatically generated.
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
                        ec_classid('TestSchema', 'Pipe') [ECClassId],
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

A view may contain navigation properties. For these, the query can use the `navigation_value`function provided by ECSQL [ECSqlFunctions](./ECSqlFunctions.md)

One example utilizing the View concepts including navigation properties is `ClassCustomAttribute` in `ECDbMeta`:

```xml
    <ECEntityClass typeName="ClassCustomAttribute" modifier="Abstract">
        <ECCustomAttributes>
            <View xmlns="ECDbMap.02.00.03">
                <Query>
                    SELECT
                        [ca].[ECInstanceId],
                        ec_classid('ECDbMeta', 'ClassCustomAttribute') [ECClassId],
                        NAVIGATION_VALUE(meta.ClassCustomAttribute.Class, [ca].[ContainerId]),
                        NAVIGATION_VALUE(meta.ClassCustomAttribute.CustomAttributeClass, [ca].[Class].[Id]),
                        XmlCAToJson([ca].[Class].[Id], [ca].[Instance]) [Instance]
                    FROM [meta].[CustomAttribute] [ca]
                    WHERE [ca].[ContainerType] = [meta].[CAContainerType].[Class]
                    ORDER BY [ca].[Ordinal]
                </Query>
            </View>
        </ECCustomAttributes>
        <ECNavigationProperty propertyName="Class" relationshipName="ClassHasCustomAttribute" direction="backward"/>
        <ECNavigationProperty propertyName="CustomAttributeClass" relationshipName="CustomAttributeClassHasInstanceOnClass" direction="backward"/>
        <ECProperty propertyName="Instance"  typeName="string" extendedTypeName="Json" />
    </ECEntityClass>
    <ECRelationshipClass typeName="ClassHasCustomAttribute" modifier="Abstract" strength="referencing">
        <ECCustomAttributes>
            <ForeignKeyBasedView xmlns="ECDbMap.02.00.03" />
        </ECCustomAttributes>
        <Source multiplicity="(1..1)" roleLabel="has custom attribute" polymorphic="false">
            <Class class="ECClassDef"/>
        </Source>
        <Target multiplicity="(0..*)" roleLabel="is set on" polymorphic="false">
            <Class class="ClassCustomAttribute"/>
        </Target>
    </ECRelationshipClass>
    <ECRelationshipClass typeName="CustomAttributeClassHasInstanceOnClass" modifier="Abstract" strength="referencing">
        <ECCustomAttributes>
            <ForeignKeyBasedView xmlns="ECDbMap.02.00.03" />
        </ECCustomAttributes>
        <Source multiplicity="(1..1)" roleLabel="has instance on" polymorphic="false">
            <Class class="ECClassDef"/>
        </Source>
        <Target multiplicity="(0..*)" roleLabel="is instance of" polymorphic="false">
            <Class class="ClassCustomAttribute"/>
        </Target>
    </ECRelationshipClass>
```
