# Unit Conversion

Unit conversion is a fundamental operation in quantity formatting and parsing. Understanding how conversions work helps you correctly handle quantity values across different unit systems.

## UnitConversionSpec

Unit conversion is performed through a [UnitConversionSpec]($quantity). These objects encapsulate the conversion factors and offsets needed to convert a value from one unit to another.

### How UnitConversionSpec Works

Unit conversions are applied through the following steps:

1. **Pre-conversion inversion** (if `inversion === InvertPreConversion`): `value = 1/value`
2. **Apply factor and offset**: `value = (value * factor) + offset`
3. **Post-conversion inversion** (if `inversion === InvertPostConversion`): `value = 1/value`

For most unit conversions (length, angle, area, etc.), only the factor is used (offset and inversion are zero/undefined). Temperature conversions use non-zero offsets. Inversion is used when converting to or from inverted units - An example would be dimensionless ratios where one unit is the mathematical inverse of another (e.g., vertical-per-horizontal slope ↔ horizontal-per-vertical slope).

## Generating UnitConversionSpec

`UnitConversionSpec` objects are created from [UnitConversionProps]($quantity) returned by a [UnitsProvider]($quantity). The provider's `getConversion` method calculates conversion properties based on unit definitions:

- **[BasicUnitsProvider]($frontend)** - Uses hardcoded conversion factors for common units
- **[SchemaUnitProvider]($ecschema-metadata)** - Calculates conversions from EC schema unit definitions
- **Custom providers** - Can implement custom conversion logic

The [FormatterSpec]($quantity) and [ParserSpec]($quantity) classes create `UnitConversionSpec` instances from these properties during initialization.

### When Conversions Are Cached

During initialization of [FormatterSpec]($quantity) and [ParserSpec]($quantity), they request and cache `UnitConversionSpec` objects from the `UnitsProvider`:

- **FormatterSpec** - Caches conversions from persistence unit to all format display units
- **ParserSpec** - Caches conversions from all units in the phenomenon to the persistence unit

This caching strategy:

- Eliminates async calls during formatting/parsing operations
- Improves performance for repeated operations
- Ensures consistent conversions throughout the spec's lifetime

## Conversion in Formatting

When formatting a quantity value:

1. The value starts in the **persistence unit** (e.g., meters)
2. The `FormatterSpec` applies the cached `UnitConversionSpec` for each display unit
3. For composite formats, each sub-unit conversion is applied in sequence
4. The converted values are formatted according to the format specification

Example: Converting 1.5 meters to feet-inches, given a [FormatProps]($quantity) that uses fractional, composite unit of feet and inches

```none
1.5 m → 4.92126 ft → 4'-11 1/16"
```

## Conversion in Parsing

When parsing a string to a quantity value:

1. The string is tokenized to extract values and unit labels
2. For each unit label, the appropriate `UnitConversionSpec` is retrieved from the cached specs
3. Each value is converted to the **persistence unit**
4. For composite values, converted sub-unit values are summed
5. The final result is returned in the persistence unit

Example: Parsing "4'-11 1/16"" to meters, given a [FormatProps]($quantity) that uses fractional, composite unit of feet and inches

```none
4' → 1.2192 m
11 1/16" → 0.28098 m
Total → 1.50018 m
```

## Unit Family Validation

Before converting, the `UnitsProvider` validates that both units belong to the same phenomenon (unit family):

- ✅ **Valid**: Length (meters) → Length (feet)
- ✅ **Valid**: Angle (radians) → Angle (degrees)
- ❌ **Invalid**: Length (meters) → Angle (degrees)

Attempting to convert between incompatible phenomena will result in an error.

## Performance Considerations

To optimize conversion performance:

1. **Reuse specs** - Create FormatterSpec and ParserSpec once and reuse them (e.g., store as class instance properties) rather than recreating on each operation
2. **Batch operations** - Format/parse multiple values with the same spec
3. **Cache providers** - Don't recreate UnitsProvider instances unnecessarily
4. **Use schema providers** - SchemaUnitProvider is more comprehensive than BasicUnitsProvider

## Example: Direct Unit Conversion

While most conversions happen automatically through FormatterSpec and ParserSpec, you can also request conversions directly from a UnitsProvider:

```ts
[[include:Quantity_UnitConversion.Direct_Conversion]]
```

## See Also

- [Units](../definitions/Units.md) - Understanding unit definitions and phenomena
- [Providers](./Providers.md) - UnitsProvider implementations
- [Parsing and Formatting](./ParsingAndFormatting.md) - How conversions are applied during formatting/parsing
- [Parser]($quantity) and [Formatter]($quantity) - Core implementation classes for formatting/parsing
