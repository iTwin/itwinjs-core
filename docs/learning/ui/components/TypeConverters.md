# TypeConverters

The [TypeConverters]($components-react:TypeConverters) category in the `@itwin/components-react` package includes
various Type Converter classes for different types.

All type converters extend the [TypeConverter]($components-react) abstract class.
The TypeConverter class implements the [SortComparer]($components-react),
[OperatorProcessor]($components-react) and [NullableOperatorProcessor]($components-react) interfaces.

Type converters may optionally implement one of the following interfaces to provide
value processing for Table filtering:

- [LessGreaterOperatorProcessor]($components-react) - numeric types
- [StringOperatorProcessor]($components-react) - string types

Each type converter must be registered with the [TypeConverterManager]($components-react)
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

- [BooleanTypeConverter]($components-react)
- [CompositeTypeConverter]($components-react)
- [DateTimeTypeConverter]($components-react)
- [EnumTypeConverter]($components-react)
- [FloatTypeConverter]($components-react)
- [HexadecimalTypeConverter]($components-react)
- [IntTypeConverter]($components-react)
- [NavigationPropertyTypeConverter]($components-react)
- [Point2dTypeConverter]($components-react)
- [Point3dTypeConverter]($components-react)
- [ShortDateTypeConverter]($components-react)
- [StringTypeConverter]($components-react)

**Note**: `TypeConverterManager.registerConverter` is called by the system for these delivered type converters.

## Standard Type Names

The [StandardTypeNames]($appui-abstract) enum can be used when populating a [PropertyDescription]($appui-abstract).
This enum contains the type names used when registering the converters listed above.

## API Reference

- [TypeConverters]($components-react:TypeConverters)
