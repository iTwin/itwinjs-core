# Updating KindOfQuantity on an ECProperty

This document provides instructions for iModel users on how to change a properties persistence unit by removing or replacing the [KindOfQuantity (KoQ)](./kindofquantity.md) associated with an [ECProperty](./ec-property.md) in an iModel schema.

## Overview

Normally changing the persistence unit of a property is not supported unless you change the major schema version.  So you can change the KOQ applied to a property so long as it does not change the persistence unit.  Applying the `AllowUnitChange` custom attribute to a property allows you to change the persistence unit with only a minor version change.  

| Change | AllowUnitChange required|
|-|-|
| Add KOQ to property that has none | not required |
| Change KOQ to KOQ with same persistence unit | not required |
| Remove KOQ from property that has one | required |
| Change KOQ to KOQ with different persistence unit | required | 

The `AllowUnitChange` custom attribute is intended for cases where the persistence unit is incorrect but the persisted value is correct.  Changing the persistence unit only updates the metadata, it **does not transform existing values**.  If conversion is needed you must do it yourself and consider updating the write (middle) schema version to make it clear that the persisted data format has changed.

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
