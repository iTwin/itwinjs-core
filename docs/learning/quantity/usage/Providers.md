- [Providers](#providers)
  - [Understanding Providers](#understanding-providers)
    - [UnitsProvider](#unitsprovider)
      - [Units Provider Concept](#units-provider-concept)
      - [BasicUnitsProvider](#basicunitsprovider)
      - [SchemaUnitProvider](#schemaunitprovider)
    - [FormatsProvider](#formatsprovider)
      - [SchemaFormatsProvider](#schemaformatsprovider)
      - [MutableFormatsProvider](#mutableformatsprovider)
      - [FormatSetFormatsProvider](#formatsetformatsprovider)
    - [AlternateUnitLabelsProvider](#alternateunitlabelsprovider)
  - [Registering Providers in iTwin Applications](#registering-providers-in-itwin-applications)
    - [Registering UnitsProvider](#registering-unitsprovider)
      - [Manual Registration](#manual-registration)
      - [Automatic Registration on IModelConnection Open](#automatic-registration-on-imodelconnection-open)
    - [Registering FormatsProvider](#registering-formatsprovider)
      - [Using SchemaFormatsProvider](#using-schemaformatsprovider)
      - [Using FormatSetFormatsProvider](#using-formatsetformatsprovider)
    - [Adding Alternate Unit Labels](#adding-alternate-unit-labels)
    - [Configuring Unit System](#configuring-unit-system)
  - [See Also](#see-also)

# Providers

Providers are the runtime components that supply format and unit definitions to formatters and parsers. Understanding the different provider types and how to register them is essential for setting up quantity formatting in iTwin.js applications.

## Understanding Providers

### UnitsProvider

The [UnitsProvider]($quantity) interface is central to unit management in iTwin.js. It provides methods to:

- Locate units by name or label
- Retrieve [UnitProps]($quantity) for a given unit
- Generate [UnitConversionSpec]($quantity) objects for converting between units

#### Units Provider Concept

A units provider acts as a registry and converter for units. When you need to format or parse a quantity value, the provider:

1. **Locates the source unit** (e.g., meters for persistence)
2. **Locates the target unit(s)** (e.g., feet and inches for display)
3. **Provides conversion factors** between these units
4. **Validates unit compatibility** (ensures units are in the same phenomenon)

#### BasicUnitsProvider

[BasicUnitsProvider]($frontend) is a standalone provider that contains common units needed for basic quantity formatting. It's used as the default provider in `IModelApp.quantityFormatter` when no iModel is open.

**Characteristics:**

- No dependencies on iModels or schemas
- Contains units for: length, angle, area, volume, time
- Sufficient for applications without schema-specific units
- Lightweight and fast

**When to use:**

- Applications without iModel dependencies, enabled by default
- Simple formatting scenarios
- Fallback when schema loading fails

#### SchemaUnitProvider

[SchemaUnitProvider]($ecschema-metadata) loads unit definitions from EC schemas stored in iModels. It provides access to the extensive Units schema as well as custom units defined in domain schemas.

**Characteristics:**

- Requires access to ECSchemas via [SchemaContext]($ecschema-metadata), commonly through iModels
- Accesses units through `SchemaContext`
- Supports custom domain-specific units
- More comprehensive than BasicUnitsProvider

**When to use:**

- Applications working with iModels
- Need for domain-specific units (civil, structural, etc.)
- When unit definitions must match schema specifications

### FormatsProvider

A [FormatsProvider]($quantity) supplies format definitions for KindOfQuantities. The [FormatDefinition]($quantity) interface extends [FormatProps](../definitions/Formats.md#formatprops) to help identify formats.

#### SchemaFormatsProvider

[SchemaFormatsProvider]($ecschema-metadata) retrieves formats from EC schemas using a [SchemaContext]($ecschema-metadata). It requires a [UnitSystemKey]($quantity) to filter formats according to the current unit system.

**Characteristics:**

- Loads formats from KindOfQuantity definitions in schemas
- Filters formats by unit system (metric, imperial, usCustomary, usSurvey)
- Throws error for invalid [EC full names](https://www.itwinjs.org/bis/ec/ec-name/#full-name)
- Read-only format provider

**Example: Simple Formatting**

<details>
<summary>Formatting with SchemaFormatsProvider</summary>

```ts
[[include:Quantity_Formatting.Schema_Formats_Provider_Simple_Formatting]]
```

</details>

**Example: Parsing**

<details>
<summary>Parsing with SchemaFormatsProvider</summary>

```ts
[[include:Quantity_Formatting.Schema_Formats_Provider_Simple_Parsing]]
```

</details>

**Example: Unit System Override**

When retrieving a format from a schema, you might want to ensure the format matches your current unit system. You can pass the unit system on initialization or change it afterward:

<details>
<summary>Formatting with Unit System Override</summary>

```ts
[[include:Quantity_Formatting.Schema_Formats_Provider_Simple_Formatting_With_Unit_System]]
```

</details>

**Example: Retrieving KindOfQuantity and Persistence Unit**

When you only have a KindOfQuantity name, you can use a SchemaContext to find the schema item and access its persistence unit:

<details>
<summary>Using SchemaContext to get KindOfQuantity and persistence unit</summary>

```ts
[[include:Quantity_Formatting.KindOfQuantityPersistenceUnitFormatting]]
```

</details>

#### MutableFormatsProvider

[MutableFormatsProvider]($quantity) extends the read-only `FormatsProvider` by allowing formats to be added or removed at runtime.

**Characteristics:**

- Supports dynamic format management
- Can add custom formats not in schemas
- Can override schema-defined formats
- Fires `onFormatsChanged` event when formats are modified

**Example: Implementation**

<details>
<summary>Example MutableFormatsProvider implementation</summary>

```ts
[[include:Quantity_Formatting.Mutable_Formats_Provider]]
```

</details>

**Example: Adding Formats**

<details>
<summary>Adding formats to MutableFormatsProvider</summary>

```ts
[[include:Quantity_Formatting.Mutable_Formats_Provider_Adding_A_Format]]
```

</details>

#### FormatSetFormatsProvider

[FormatSetFormatsProvider]($ecschema-metadata) manages formats within a [FormatSet](../definitions/FormatSets.md). This provider automatically updates the underlying format set when formats are added or removed, making it ideal for applications that need to persist format changes.

**Key Features:**

- **String Reference Resolution**: Automatically resolves string references to their target FormatDefinition. When a format references another via string (e.g., `"DefaultToolsUnits.LENGTH": "CivilUnits.LENGTH"`), the provider resolves and returns the actual FormatDefinition.
- **Chain Resolution**: Supports chains of references with circular reference detection.
- **Cascade Notifications**: When adding or removing a format, the `onFormatsChanged` event includes not only the modified format but also all formats that reference it (directly or indirectly).
- **Fallback Provider**: String references can resolve through an optional fallback provider if the target format isn't found in the format set.

**Example: FormatSet with String References**

<details>
<summary>Using FormatSetFormatsProvider with string references</summary>

```ts
[[include:Quantity_Formatting.FormatSet_Formats_Provider_With_String_References]]
```

</details>

### AlternateUnitLabelsProvider

[AlternateUnitLabelsProvider]($quantity) allows specifying alternate labels for units during parsing. This is useful for:

- Supporting common abbreviations (e.g., "ft" and "foot" for feet)
- Enabling easier keyboard input (e.g., "^" for degrees "°")
- Accommodating regional variations in unit labels

## Registering Providers in iTwin Applications

This section covers how to register and configure providers in your iTwin application. Proper provider registration ensures consistent quantity formatting across your application.

### Registering UnitsProvider

#### Manual Registration

You can manually register a SchemaUnitProvider when opening an iModel:

<details>
<summary>Manual SchemaUnitProvider registration</summary>

```ts
[[include:Quantity_Formatting.SchemaUnitProvider_Registration]]
```

</details>

#### Automatic Registration on IModelConnection Open

The recommended approach is to automatically register the provider when any IModelConnection opens:

<details>
<summary>Automatic registration via IModelConnection.onOpen</summary>

```ts
[[include:Quantity_Formatting.IModelConnection_OnOpen_Registration]]
```

</details>

If errors occur while configuring the units provider, they are caught within the [QuantityFormatter.setUnitsProvider]($frontend) method, and the code reverts back to [BasicUnitsProvider]($frontend).

### Registering FormatsProvider

#### Using SchemaFormatsProvider

Register a SchemaFormatsProvider to load formats from iModel schemas:

<details>
<summary>Registering SchemaFormatsProvider on IModelConnection open</summary>

```ts
[[include:Quantity_Formatting.Schema_Fmt_Provider_on_IModelConnection_Open]]
```

</details>

#### Using FormatSetFormatsProvider

For applications that persist user format preferences:

```ts
// Load FormatSet from application settings
const formatSet: FormatSet = await loadUserFormatPreferences();

// Create provider with optional fallback
const fallbackProvider = new SchemaFormatsProvider(schemaContext);
const formatSetProvider = new FormatSetFormatsProvider(formatSet, fallbackProvider);

// Register with IModelApp
IModelApp.formatsProvider = formatSetProvider;

// Listen for changes to update persistence
formatSetProvider.onFormatsChanged.addListener((formats) => {
  // Save updated format set to user preferences
  saveUserFormatPreferences(formatSet);
});
```

### Adding Alternate Unit Labels

Add alternate unit labels for easier input during parsing:

<details>
<summary>Adding alternate unit labels</summary>

```ts
[[include:Quantity_Formatting.Alternate_Unit_Labels]]
```

</details>

### Configuring Unit System

Set the active unit system for the QuantityFormatter:

<details>
<summary>Configuring unit system</summary>

```ts
[[include:Quantity_Formatting.Unit_System_Configuration]]
```

</details>

## See Also

- [Units](../definitions/Units.md) - Understanding unit definitions
- [Formats](../definitions/Formats.md) - Format specifications
- [Format Sets](../definitions/FormatSets.md) - Application-level format persistence
- [Parsing and Formatting](./ParsingAndFormatting.md) - Using providers with FormatterSpec and ParserSpec
