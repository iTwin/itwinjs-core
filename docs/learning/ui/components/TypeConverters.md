# TypeConverters

The [TypeConverters]($ui-components:TypeConverters) category in the `@bentley/ui-components` package includes
various Type Converter classes for different types.

All type converters extend the [TypeConverter]($ui-components) abstract class.
The TypeConverter class implements the [SortComparer]($ui-components),
[OperatorProcessor]($ui-components) and [NullableOperatorProcessor]($ui-components) interfaces.

Type converters may optionally implement one of the following interfaces to provide
value processing for Table filtering:

- [LessGreaterOperatorProcessor]($ui-components) - numeric types
- [StringOperatorProcessor]($ui-components) - string types

Each type converter must be registered with the [TypeConverterManager]($ui-components)
for a given type name
by calling the `registerConverter` method.

```ts
TypeConverterManager.registerConverter("string", StringTypeConverter);
```

A type converter may be obtained for a certain type name by calling the
`TypeConverterManager.getConverter` method:

```ts
const typeConverter = TypeConverterManager.TypeConverterManager.getConverter("string");
```

The following is a list of the provided type converters:

- [BooleanTypeConverter]($ui-components)
- [CompositeTypeConverter]($ui-components)
- [DateTimeTypeConverter]($ui-components)
- [EnumTypeConverter]($ui-components)
- [FloatTypeConverter]($ui-components)
- [HexadecimalTypeConverter]($ui-components)
- [IntTypeConverter]($ui-components)
- [NavigationPropertyTypeConverter]($ui-components)
- [Point2dTypeConverter]($ui-components)
- [Point3dTypeConverter]($ui-components)
- [ShortDateTypeConverter]($ui-components)
- [StringTypeConverter]($ui-components)

**Note**: `TypeConverterManager.registerConverter` is called by the system for these delivered type converters.

## Standard Type Names

The [StandardTypeNames]($ui-abstract) enum can be used when populating a [PropertyDescription]($ui-abstract).
This enum contains the type names used when registering the converters listed above.

## API Reference

- [TypeConverters]($ui-components:TypeConverters)
