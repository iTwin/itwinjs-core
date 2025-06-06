# ECProperty

This section starts by describing the common parts of the 5 property types in ECObjects before going into detail of each individual type. The 5 property types supported in ECObjects are [ECPrimitiveProperty](#ecprimitiveproperty), [ECStructProperty](#ecstructproperty), [ECArrayProperty](#ecprimitivearrayproperty), [ECStructArrayProperty](#ecstructarrayproperty) and [ECNavigationProperty](#ecnavigationproperty).

Each property type models a different type of named value contained within an object.

All property types may have a single base property determined using the base class traversal algorithm described. A derived property or property override may not change the property type or persistence unit (via KindOfQuantity).  A derived property inherits custom attributes from its base property, a custom attribute applied to the derived property overrides an inherited one of the same class.

### Common Attributes

**name** The name of the property in the class. Must be a valid [ECName](./ec-name.md) and unique within the class it exists in.

**typeName** The data type of the property. The valid data types depend on the type of property.

**description** User facing description of the property. Localized and may be shown in the UI.

**displayLabel** a localized display label that will be used instead of the name in the GUI. If not set the name of the property will be used.

**readOnly** If true the property may only ever be initialized to a value, once set it cannot be changed.

**priority** a number value that specifies the importance of this property in relation to other properties defined within the class.

**kindOfQuantity** the name of the [Kind Of Quantity](./kindofquantity.md) to associate with this property.

**category** the name of the [Property Category](./property-category.md) to that classify this property.

### Custom Attributes

ECProperties may have [Custom Attributes](./ec-custom-attributes.md) applied and inherit the custom attributes applied to any property they override.  Custom attributes applied to a base property may be overriden by applying the same custom attribute applied to a derived property.

### Common Sub-Elements

[ECCustomAttributes](./ec-custom-attributes.md) _(0..1)_

## ECPrimitiveProperty

An ECPrimitiveProperty models a property, with a limited set of [primitive value types](./primitive-types.md) and [ECEnumerations](./ec-enumeration.md), in an [ECClass](./ec-class.md) and may be used in any type of [ECClass](./ec-class.md).

### Primitive Property Additional Optional Attributes

**minimumValue** The minimum valid value for this property. Supported for primitive types int, long, and double.

**maxmimumValue** The maximum valid value for this property. Supported for primitive types int, long, and double.

**minimumLength** The minimum valid length. Supported for primitive types, string and binary.

**maximumLength** The minimum valid length. Supported for primitive types, string and binary.

**extendedTypeName** The name of an extended type to associate with this property. See Extended Types section for more info. An extended type is a special, in memory handler for values with the extended type specified. The extended type may not change the storage of the value and the basic type will be used if the extended type cannot be found.

### Primitive Property Example

```xml
<ECProperty propertyName="OverallHeight" typeName="double" kindOfQuantity="AECU:LENGTH_SHORT"/>
```

```json
{
  "name": "OverallHeight",
  "type": "PrimitiveProperty",
  "description": "Overall Height of the Door",
  "label": "Overall Height",
  "kindOfQuantity": "AecUnits.LENGTH_SHORT",
  "typeName": "double"
},
```

## ECPrimitiveArrayProperty

A Primitive Array Property (`ECArrayProperty`) models an array of primitive values of the same type indexed by a 64 bit unsigned integer. The array may have a minimum and maximum number of entries specified and supports sparse indexes. Array properties may have any type that is valid for a primitive property.

### Primitive Array Property Additional Optional Attributes

**minOccurs** defaults to 0. Indicates the minimum number of elements in the array.

**maxOccurs** Indicates the maximum number of elements in an ECArrayProperty. Use "unbounded" for arrays with no upper limit.

**extendedTypeName** The name of an extended type to associate with this property. See Extended Types section for more info.

### Primitive Array Property Example

```xml
<ECArrayProperty propertyName="PropertyNames" typeName="string" minOccurs="0" maxOccurs="unbounded"/>
```

```json
{
  "name": "PropertyNames",
  "type": "PrimitiveArrayProperty",
  "typeName": "string",
  "minOccurs": 0,
  "maxOccurs": 2147483647
}
```

## ECStructProperty

A Struct Property (`ECStructProperty`) models a complex property whose value is an embedded instance of an [ECStructClass](./ec-struct-class), polymorphism is not supported. The typeName of the property has to be set to an [ECStructClass](./ec-struct-class.md).

## Struct Property Example

```xml
<ECStructProperty propertyName="AtPosition" typeName="DistanceExpression"/>
```

```json
{
  "name": "AtPosition",
  "type": "StructProperty",
  "label": "At-Position",
  "typeName": "LinearReferencing.DistanceExpression"
},
```

See [EC Struct Class](./ec-struct-class.md) for struct class definition information.

## ECStructArrayProperty

A Struct Array Property (`ECStructArrayProperty`) models an array of values of embedded instances of an ECStructClass, polymorphism is not supported. The typeName of the property has to be set to an [ECStructClass](./ec-struct-class.md).

### Struct Array Property Additional Optional Attributes

**minOccurs** defaults to 0. Indicates the minimum number of elements in the array.

**maxOccurs** Indicates the maximum number of elements in an ECArrayProperty. Use "unbounded" for arrays with no upper limit.

### Struct Array Property Example

```xml
<ECStructArrayProperty propertyName="Forces" typeName="LinearForce" displayLabel="Forces" description="Force values." />
```

```json
{
  "name": "Forces",
  "type": "StructArrayProperty",
  "description": "Force values.",
  "label": "Forces",
  "typeName": "StructuralAnalysis.LinearForce",
  "minOccurs": 0,
  "maxOccurs": 2147483647
}
```

## ECNavigationProperty

A Navigation Property models a reference to another instance, i.e. a related instance.  This reference may be as simple as the Id of the related instance, it may actually point to an in memory copy of the instance, a URL to load the related instance, or a query to select the related instance.

> Navigation Properties are only valid on classes which can be relationship endpoints: ECEntityClass, ECMixinClass and ECRelationshipClass.

Addition rules apply to navigation properties:

- May only point to a singular endpoint. That is, it must point to an endpoint whose multiplicity has a max limit of 1.
- Must be added to the most base ECEntityClass supported by the referenced relationship.
- Must reference the root relationship in a hierarchy.
- The referenced relationship may not be overridden by property overrides in derived classes[].

### Navigation Property Additional Optional Attributes

**relationshipName** The relationship this navigation property traverses to the get the related instance.

**direction** The direction to traverse the referenced relationship

### Navigation Property Example

```xml
<ECNavigationProperty propertyName="Parent" relationshipName="ElementOwnsChildElements" direction="backward" />
```

```json
{
  "name": "Parent",
  "type": "NavigationProperty",
  "relationshipName": "BisCore.ElementOwnsChildElements",
  "direction": "Backward"
},
```
