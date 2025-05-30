# ECSQL null behavior documentation

## Setting of a property to null

A value can be directly changed to be null - not contain a value at all. This can be applied for each editable ECSQL parameter type.

Documentation schema sample:

``` xml
<ECSchema schemaName="NullBehaviorDocs" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
  <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA"/>
  <ECEntityClass typeName="DocsElement" modifier="None">
    <ECProperty propertyName="intProp" typeName="int"/>
    <ECArrayProperty propertyName="arrBoolProp" typeName="boolean" minOccurs="0" maxOccurs="unbounded"/>
    <ECStructProperty propertyName="structProp" typeName="StructType"/>
    <ECStructArrayProperty propertyName="arrStructProp" typeName="StructType" minOccurs="0" maxOccurs="unbounded"/>
  </ECEntityClass>
  <ECStructClass typeName="StructType" modifier="None">
    <ECProperty propertyName="doubleProp" typeName="double"/>
    <ECProperty propertyName="stringProp" typeName="string"/>
  </ECStructClass>
</ECSchema>
```

Attempting to update any of the properties (`intProp`, `arrBoolProp`, `structProp` or `arrStructProp`, as well as `structProp.doubleProp` and `structProp.stringProp`) to null should clear the current value of the respective property.

## Setting some complex property children to null

To be added

## Setting all complex property children to null or making it empty

To be added
