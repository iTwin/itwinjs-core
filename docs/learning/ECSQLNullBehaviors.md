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
    <ECProperty propertyName="p2dProp" typeName="point2d"/>
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

This section would cover partially setting a complex property (point2d, struct, array) to null.

- A `point2d` type property must always have all its coordinates present, hence updating a point2d to be partially null is not a valid input and would result in the property not being updated. This is why updating `p2dProp` to `{ x: null, y: 2.5 }` would be invalid and take no effect on the element's property.
- A `struct` type property can have all of their children properties set to null. The child property would end up being cleared from the parent object with the remaining properties remaining intact. If all of the struct's children become null, the struct itself is considered to be null. This means that if `structProp` would include `{ doubleProp: 41.0, stringProp: null }`, the string property would be cleared with the doubleProp successfully updated to the expected value.
- An `array` type property can store null values as any other value of the respective type. It would happen to be represented alongside the ordinary properties as null. However, similarly to structs, if all of the array's entries are nulls, the array itself is considered to be null. E.g. updating `arrBoolProp` to `[false, true, null, false]` is a perfectly valid data entry for a boolean type array property.

## Setting all complex property children to null or making it empty

To be added
