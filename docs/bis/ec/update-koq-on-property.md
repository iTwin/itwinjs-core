# KindOfQuantity

> Commonly referred to as a [KOQ](./kindofquantity.md).

Describes a strongly typed _kind_ for a property. This kind identifies what is being measured and stored in an [ECProperty](./ec-property.md). It is used for grouping like properties, setting units and display formatting, and creating quantity objects.

## Removing KindOfQuantity from a property

Removing KOQ from an [ECProperty](./ec-property.md) is supported by using `AllowUnitChange` [Custom Attribute](./ec-custom-attributes.md) on the property. However, while using `AllowUnitChange` [Custom Attribute](./ec-custom-attributes.md) it must have both 'From' and 'To' properties set.

Additionally, the 'From' value must match the persistence unit from the old KindOfQuantity and the 'To' value must be empty.

### Examples

Consider following [ECProperty](./ec-property.md) having [KindOfQuantity](./kindofquantity.md) attached to it:

```xml
<KindOfQuantity typeName='MyKindOfQuantity' description='My KindOfQuantity'
				displayLabel='My KindOfQuantity' persistenceUnit='CM' relativeError='.5'
				presentationUnits='FT;IN;M' />
<ECEntityClass typeName='Foo' >
	<ECProperty propertyName='Length' typeName='double' kindOfQuantity='MyKindOfQuantity' />
</ECEntityClass>
```

Following are some Valid and Invalid ways of using `AllowUnitChange` [Custom Attribute](./ec-custom-attributes.md) to remove [KOQ](./kindofquantity.md) from the ECProperty:

#### Valid `AllowUnitChange` [Custom Attribute](./ec-custom-attributes.md)

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

#### Invalid/malformed `AllowUnitChange` [Custom Attribute](./ec-custom-attributes.md)

```xml
<ECProperty propertyName='Length' typeName='double' />
```

```xml
<ECProperty propertyName='Length' typeName='double'>
	<ECCustomAttributes>
		<AllowUnitChange xmlns="SchemaUpgradeCustomAttributes.01.00.00">
		</AllowUnitChange>
	</ECCustomAttributes>
</ECProperty>
```

```xml
<ECProperty propertyName='Length' typeName='double'>
	<ECCustomAttributes>
		<AllowUnitChange xmlns="SchemaUpgradeCustomAttributes.01.00.00">
			<From>u:CM</From>
		</AllowUnitChange>
	</ECCustomAttributes>
</ECProperty>
```

```xml
<ECProperty propertyName='Length' typeName='double'>
	<ECCustomAttributes>
		<AllowUnitChange xmlns="SchemaUpgradeCustomAttributes.01.00.00">
			<From>u:M</From>
			<To></To>
		</AllowUnitChange>
	</ECCustomAttributes>
</ECProperty>
```

## Replacing KindOfQuantity of a property

Changing the KindOfQuantity of an ECProperty to another KindOfQuantity with a different persistence unit is allowed by using the `AllowUnitChange` [Custom Attribute](./ec-custom-attributes.md) on the property. However, `AllowUnitChange` [Custom Attribute](./ec-custom-attributes.md) must have non-empty From and To properties.

Additionally, the 'From' value must match the persistence unit from the old KindOfQuantity and the 'To' value must match the persistence unit from the new KindOfQuantity.

### Examples

Consider following [ECProperty](./ec-property.md) having [KindOfQuantity](./kindofquantity.md) attached to it:

```xml
<KindOfQuantity typeName='KindOfQuantity1' description='KindOfQuantity1'
				displayLabel='KindOfQuantity1' persistenceUnit='u:CM' relativeError='.5'
				presentationUnits='f:AmerFI[u:FT][u:IN]' />
<ECEntityClass typeName='Foo' >
	<ECProperty propertyName='Length' typeName='double' kindOfQuantity='KindOfQuantity1' />
</ECEntityClass>
```

Following are some Valid and Invalid ways of using `AllowUnitChange` [Custom Attribute](./ec-custom-attributes.md) to replace [KindOfQuantity](./kindofquantity.md) from the ECProperty:

#### Valid `AllowUnitChange` [Custom Attribute](./ec-custom-attributes.md)

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

#### Invalid/malformed `AllowUnitChange` [Custom Attribute](./ec-custom-attributes.md)

```xml
<KindOfQuantity typeName='KindOfQuantity1' description='KindOfQuantity1'
				displayLabel='KindOfQuantity1' persistenceUnit='u:CM' relativeError='.5'
				presentationUnits='f:AmerFI[u:FT][u:IN]' />
<KindOfQuantity typeName='KindOfQuantity2' description='KindOfQuantity2'
				displayLabel='KindOfQuantity2' persistenceUnit='u:M' relativeError='.2'
				presentationUnits='f:AmerFI[u:FT][u:IN]' />
<ECEntityClass typeName='Foo' >
	<ECProperty propertyName='Length' typeName='double' kindOfQuantity='KindOfQuantity2' >
	</ECProperty>
</ECEntityClass>
```

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
			</AllowUnitChange>
		</ECCustomAttributes>
	</ECProperty>
</ECEntityClass>
```

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
			</AllowUnitChange>
		</ECCustomAttributes>
	</ECProperty>
</ECEntityClass>
```

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
				<To></To>
			</AllowUnitChange>
		</ECCustomAttributes>
	</ECProperty>
</ECEntityClass>
```
