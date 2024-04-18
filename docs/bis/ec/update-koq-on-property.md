# Updating KindOfQuantity on an ECProperty

This document provides instructions for iModel users on how to remove or replace a [KindOfQuantity (KoQ)](./kindofquantity.md) associated with an [ECProperty](./ec-property.md) in an iModel schema.

**Note**: Removing or Replacing KindOfQuantity from a property does not alter other attributes or the fundamental data type of the property.

## Removing KindOfQuantity from a property

Removing KOQ from an [ECProperty](./ec-property.md) is supported by using `AllowUnitChange` [Custom Attribute](./ec-custom-attributes.md) on the property. However, while using `AllowUnitChange` [Custom Attribute](./ec-custom-attributes.md) it must have both 'From' and 'To' properties set.

- **From**: Set this value to be the persistence unit associated with the KindOfQuantity you want to remove. This value must exactly match the existing persistence unit.
- **To**: Set this value to be empty, indicating the removal of the KindOfQuantity.

### Example:

Consider following [ECProperty](./ec-property.md) having [KindOfQuantity](./kindofquantity.md) attached to it:

```xml
<KindOfQuantity typeName='MyKindOfQuantity' description='My KindOfQuantity'
				displayLabel='My KindOfQuantity' persistenceUnit='CM' relativeError='.5'
				presentationUnits='FT;IN;M' />
<ECEntityClass typeName='Foo' >
	<ECProperty propertyName='Length' typeName='double' kindOfQuantity='MyKindOfQuantity' />
</ECEntityClass>
```

`AllowUnitChange` [Custom Attribute](./ec-custom-attributes.md) can be used to remove [KOQ](./kindofquantity.md) from the ECProperty as shown below:

```xml
<ECProperty propertyName='Length' typeName='double'>
	<ECCustomAttributes>
		<AllowUnitChange xmlns="SchemaUpgradeCustomAttributes.01.00.00">
			<From>u:CM</From>
			<To></To>
		</AllowUnitChange>
	</ECCustomAttributes>
</ECProperty>
```

## Replacing KindOfQuantity of a property

Changing the KindOfQuantity of an ECProperty to another KindOfQuantity with a different persistence unit is allowed by using the `AllowUnitChange` [Custom Attribute](./ec-custom-attributes.md) on the property. However, `AllowUnitChange` [Custom Attribute](./ec-custom-attributes.md) must have non-empty 'From' and 'To' properties.

Additionally, the 'From' value must match the persistence unit from the old KindOfQuantity and the 'To' value must match the persistence unit from the new KindOfQuantity.

- **From**: Set this value to be the persistence unit associated with the KindOfQuantity you want to remove. This value must exactly match the old persistence unit.
- **To**: Set this value to be the persistence unit associated with the KindOfQuantity you want to add. This value must exactly match the new persistence unit.

### Example:

Consider following [ECProperty](./ec-property.md) having [KindOfQuantity](./kindofquantity.md) attached to it:

```xml
<KindOfQuantity typeName='KindOfQuantity1' description='KindOfQuantity1'
				displayLabel='KindOfQuantity1' persistenceUnit='u:CM' relativeError='.5'
				presentationUnits='f:AmerFI[u:FT][u:IN]' />
<ECEntityClass typeName='Foo' >
	<ECProperty propertyName='Length' typeName='double' kindOfQuantity='KindOfQuantity1' />
</ECEntityClass>
```

`AllowUnitChange` [Custom Attribute](./ec-custom-attributes.md) can be used to replace [KindOfQuantity](./kindofquantity.md) from the ECProperty as shown below:

```xml
<KindOfQuantity typeName='KindOfQuantity1' description='KindOfQuantity1'
				displayLabel='KindOfQuantity1' persistenceUnit='u:CM' relativeError='.5'
				presentationUnits='f:AmerFI[u:FT][u:IN]' />
<KindOfQuantity typeName='KindOfQuantity2' description='KindOfQuantity2'
				displayLabel='KindOfQuantity2' persistenceUnit='u:M' relativeError='.2'
				presentationUnits='f:AmerFI[u:FT][u:IN]' />
<ECEntityClass typeName='Foo' >
	<ECProperty propertyName='Length' typeName='double' kindOfQuantity='KindOfQuantity2' >
		<ECCustomAttributes>
			<AllowUnitChange xmlns="SchemaUpgradeCustomAttributes.01.00.00">
				<From>u:CM</From>
				<To>u:M</To>
			</AllowUnitChange>
		</ECCustomAttributes>
	</ECProperty>
</ECEntityClass>
```
