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
2. **Locates the target unit** (e.g., feet and inches for display)
3. **Provides conversion factors** between these units
4. **Validates unit compatibility** (ensures units are in the same phenomenon)

#### BasicUnitsProvider

[BasicUnitsProvider]($quantity) is a standalone provider backed by the full BIS `Units` schema bundled as a JSON asset in `@itwin/core-quantity`. It is the default provider used by `IModelApp.quantityFormatter` when no iModel-specific provider is registered.

**Characteristics:**

- No dependencies on iModels or schemas — works in any context (frontend, backend, tools)
- Contains all BIS units covering all phenomena (length, area, volume, temperature, pressure, angle, force, velocity, etc.)
- Unit data is resolved lazily on first use and cached at module scope — construction is essentially free, and multiple instances share the same immutable lookup indexes
- Available from `@itwin/core-quantity`, so it can be used outside `@itwin/core-frontend`
- The bundled unit data is versioned: `version` tracks the serialization format, and `sourceEcSchemaVersion` records which BIS Units EC schema release the data was derived from

**When to use:**

- Default for all applications — enabled automatically by `QuantityFormatter`
- Backend or CLI tools that need unit resolution without an iModel
- UIs and workflows that don't need an iModel, like iTwin-level workflows
- As a lightweight alternative to `SchemaUnitProvider` when domain-specific custom units are not needed

> **Note:** The `BasicUnitsProvider` previously exported from `@itwin/core-frontend` was a limited provider (≈40 units) and has been removed. Use [BasicUnitsProvider]($quantity) from `@itwin/core-quantity` instead.

#### createUnitsProvider

[createUnitsProvider]($quantity) is a factory function that layers a `primary` provider (such as `SchemaUnitProvider`) on top of `BasicUnitsProvider`. Schema-defined units win on overlap; basic BIS units fill any gaps. Pass `bisUnitsPolicy: "preferBundled"` to invert precedence so the bundled BIS units win instead.

```typescript
import { createUnitsProvider } from "@itwin/core-quantity";
import { SchemaUnitProvider } from "@itwin/ecschema-metadata";

const provider = createUnitsProvider({
  primary: new SchemaUnitProvider(schemaContext),
});
// SchemaUnitProvider units win; BasicUnitsProvider fills gaps
```

When no `primary` is supplied, `createUnitsProvider()` returns a plain `new BasicUnitsProvider()` — no wrapper.

#### SchemaUnitProvider

[SchemaUnitProvider]($ecschema-metadata) loads unit definitions from EC schemas using a [SchemaContext]($ecschema-metadata). It provides access to the extensive Units schema as well as custom units defined in domain schemas.

**Characteristics:**

- Requires access to ECSchemas via [SchemaContext]($ecschema-metadata), commonly through iModels
- Accesses units through [SchemaContext]($ecschema-metadata)
- Supports custom domain-specific units not included in the bundled BIS `Units` schema

**When to use:**

- Applications working with iModels
- When domain-specific units (civil, structural, etc.) are needed
- When unit definitions must match schema specifications

### FormatsProvider

A [FormatsProvider]($quantity) supplies format definitions for a [KindOfQuantity]($docs/bis/ec/kindofquantity/). The [FormatDefinition]($quantity) interface extends [FormatProps](../definitions/Formats.md#formatprops) to help identify formats.

#### SchemaFormatsProvider

[SchemaFormatsProvider]($ecschema-metadata) retrieves formats from EC schemas using a [SchemaContext]($ecschema-metadata). It requires a [UnitSystemKey]($quantity) to filter formats according to the current unit system.

**Characteristics:**

- Loads formats from KindOfQuantity definitions in schemas
- Filters formats by unit system preference group — see [Unit Systems and UnitSystemKey](../definitions/Units.md#unit-systems-and-unitsystemkey) for how each key maps to EC UnitSystems
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

[MutableFormatsProvider]($quantity) extends the read-only [FormatsProvider]($quantity) by allowing formats to be added or removed at runtime.

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

If errors occur while configuring the units provider, they are caught within the [QuantityFormatter.setUnitsProvider]($frontend) method, and the code reverts back to [BasicUnitsProvider]($quantity).

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

<details>
<summary>Registering FormatSetFormatsProvider with IModelApp</summary>

```ts
[[include:Quantity_Formatting.Register_FormatSet_Formats_Provider]]
```

</details>

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
