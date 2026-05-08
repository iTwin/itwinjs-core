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

- **[BasicUnitsProvider]($quantity)** - Resolves conversions from the bundled BIS Units schema. Default provider.
- **[SchemaUnitProvider]($ecschema-metadata)** - Calculates conversions from EC schema unit definitions
- **Custom providers** - Can implement custom conversion logic

The [FormatterSpec]($quantity) and [ParserSpec]($quantity) classes create `UnitConversionSpec` instances from these properties during initialization.

### When Conversions Are Cached

During initialization of [FormatterSpec]($quantity) and [ParserSpec]($quantity), they request and cache [UnitConversionSpec]($quantity) objects from the [UnitsProvider]($quantity):

- **FormatterSpec** - Caches conversions from persistence unit to all format display units
- **ParserSpec** - Caches conversions from all units in the phenomenon to the persistence unit

This caching strategy:

- Eliminates async calls during formatting/parsing operations
- Improves performance for repeated operations
- Ensures consistent conversions throughout the spec's lifetime

## Conversion in Formatting

When formatting a quantity value:

1. The value starts in the **persistence unit** (e.g., meters)
2. The [FormatterSpec]($quantity) applies the cached [UnitConversionSpec]($quantity) for each display unit
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

Before converting, the [UnitsProvider]($quantity) validates that both units belong to the same phenomenon (unit family):

- ✅ **Valid**: Length (meters) → Length (feet)
- ✅ **Valid**: Angle (radians) → Angle (degrees)
- ❌ **Invalid**: Length (meters) → Angle (degrees)

Attempting to convert between incompatible phenomena will result in an error.

## Performance Considerations

To optimize conversion performance:

1. **Reuse specs** - Create FormatterSpec and ParserSpec once and reuse them (e.g., store as class instance properties) rather than recreating on each operation
2. **Batch operations** - Format/parse multiple values with the same spec
3. **Cache providers** - Don't recreate UnitsProvider instances unnecessarily
4. **Use the default BasicUnitsProvider** - It covers the full BIS unit set; only switch to SchemaUnitProvider when you need custom domain-specific units

## Example: Direct Unit Conversion

While most conversions happen automatically through FormatterSpec and ParserSpec, you can also request conversions directly from a UnitsProvider:

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_UnitConversion.Direct_Conversion]]
```

</details>

## Basic Unit Conversion

Use the basic conversion helpers when both units come from the built-in unit data shipped with `core-quantity`.
This is the simplest path for common BIS units and does not require any app startup/init hook.

For a one-off conversion, use [UnitConversions]($quantity).[convertBasic]($quantity):

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_UnitConversion.Basic_Convert]]
```

</details>

For repeated conversions within the same basic unit pair, resolve once and reuse the conversion with [UnitConversions]($quantity).[getBasicConversion]($quantity) and [UnitConversions]($quantity).[convertValue]($quantity). `getBasicConversion(...)` may still return `UnitConversionProps` with `error: true` for incompatible units, so apply the result with `convertValue(...)` rather than using the raw factors directly:

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_UnitConversion.Basic_Repeated_Convert]]
```

</details>

## Provider-backed Unit Conversion

Use the provider-backed helpers when unit lookup/conversion must go through a [UnitsProvider]($quantity), for example when the caller is not limited to the built-in basic unit set. As with the basic repeated-conversion path, `getConversion(...)` may return `UnitConversionProps` with `error: true` for incompatible units, so apply the result with `convertValue(...)` or use `convert(...)` for the throwing one-shot path.

<details>
<summary>Example Code</summary>

```ts
[[include:Quantity_UnitConversion.Provider_Convert]]
```

</details>

> **Note:** [UnitConversions]($quantity).[convert]($quantity) and [UnitConversions]($quantity).[getConversion]($quantity) stay asynchronous because `UnitsProvider` lookup/conversion methods are async by contract.
>
> **Note:** [UnitConversions]($quantity).[convertBasic]($quantity) and [UnitConversions]($quantity).[getBasicConversion]($quantity) use pre-resolved built-in basic conversion data shipped with `core-quantity`, so they do not require app startup/init hooks.
>
> **Note:** [UnitConversions]($quantity).[getConversion]($quantity) and [UnitConversions]($quantity).[getBasicConversion]($quantity) may still return `UnitConversionProps` with `error: true` for incompatible units. [UnitConversions]($quantity).[convertValue]($quantity), [UnitConversions]($quantity).[convert]($quantity), and [UnitConversions]($quantity).[convertBasic]($quantity) are the throwing application paths. Lookup-based helpers also throw when a unit name cannot be resolved.

## See Also

- [Units](../definitions/Units.md) - Understanding unit definitions and phenomena
- [Providers](./Providers.md) - UnitsProvider implementations
- [Parsing and Formatting](./ParsingAndFormatting.md) - How conversions are applied during formatting/parsing
- [Parser]($quantity) and [Formatter]($quantity) - Core implementation classes for formatting/parsing
