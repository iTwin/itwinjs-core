# Units

Units are the foundational building blocks for quantity formatting and parsing. Understanding how units work, how they're organized, and how conversions are performed is essential for working with quantity formatting in iTwin.js.

## Common Terms

- **Unit** - A named unit of measure that can be located by its name or label. The definition of any unit is represented through its [UnitProps]($quantity).

- **Unit Family/[Phenomenon]($ecschema-metadata)** - A physical quantity that can be measured (e.g., length, temperature, pressure). Only units in the same phenomenon can be converted between each other. See [Unit Families and Phenomena](#unit-families-and-phenomena) below.

- **Persistence Unit** - The unit used to store a quantifiable value in memory or to persist the value in an editable [iModel](../../learning/iModels.md). iModels define the persistence unit through [KindOfQuantity]($docs/bis/ec/kindofquantity/) objects.

## Units Provider

The [UnitsProvider]($quantity) interface is central to unit management in iTwin.js. Providers locate units, retrieve unit properties, and generate conversion specifications between units.

For detailed information about units providers and their usage, see [Providers](../usage/Providers.md#UnitsProvider).

## Unit Families and Phenomena

Units are grouped into families based on the physical quantity they measure. This grouping is called a **Phenomenon** in EC terminology. Key characteristics:

- Units in the same phenomenon can be converted between each other
- Units in different phenomena cannot be converted (e.g., length to temperature)
- Common phenomena include: LENGTH, ANGLE, AREA, VOLUME, TIME, TEMPERATURE, PRESSURE

Understanding phenomena is crucial when:

- Defining composite formats (all units must be in the same phenomenon)
- Parsing user input (parser only considers units in the same phenomenon as the target)
- Creating custom formats

For example, velocity is a phenomenon composed of length over time that groups related units such as meters per second (m/s) and miles per hour (mph). This means you can convert values represented in meters per second into miles per hour, centimeters per day, or yards per second. See [Unit Conversion](../usage/UnitConversion.md#example-direct-unit-conversion) on an example of performing direct unit conversion between all the different units above.

You can explore all phenomena that iTwin.js supports using the [iModel Schema Editor](https://imodelschemaeditor.bentley.com/?stage=browse&elementtype=phenomenon&id=Units.VELOCITY), which shows the VELOCITY phenomenon and its associated units.

## Persistence Units

Every quantity value in an iModel has an associated persistence unit - the unit in which the value is stored. This ensures:

- **Consistency**: All values of the same type use the same unit
- **Precision**: No loss of precision from repeated conversions
- **Interoperability**: Different applications can interpret the stored values correctly

The persistence unit is defined by the [KindOfQuantity]($docs/bis/ec/kindofquantity/) associated with the property. Common persistence units:

| Phenomenon | Typical Persistence Unit |
| ---------- | ------------------------ |
| LENGTH | Units.M (meters) |
| ANGLE | Units.RAD (radians) |
| AREA | Units.SQ_M (square meters) |
| VOLUME | Units.CUB_M (cubic meters) |
| TIME | Units.S (seconds) |

## Unit Systems and UnitSystemKey

EC schemas define a rich set of `UnitSystem` elements (SI, IMPERIAL, USCUSTOM, USSURVEY, INTERNATIONAL, FINANCE, CGS, MARITIME, and others). At the application level, iTwin.js groups these into four user-facing preference groups via [UnitSystemKey]($quantity):

| UnitSystemKey    | Description              | EC UnitSystems matched (highest priority first) |
| ---------------- | ------------------------ | ----------------------------------------------- |
| `"metric"`       | International System     | SI / METRIC, INTERNATIONAL, FINANCE             |
| `"imperial"`     | Imperial (UK)            | IMPERIAL, USCUSTOM, INTERNATIONAL, FINANCE      |
| `"usCustomary"`  | US Customary             | USCUSTOM, INTERNATIONAL, FINANCE                |
| `"usSurvey"`     | US Survey                | USSURVEY, USCUSTOM, INTERNATIONAL, FINANCE      |

When a [SchemaFormatsProvider]($ecschema-metadata) resolves a format for a [KindOfQuantity]($docs/bis/ec/kindofquantity/), it walks the active `UnitSystemKey`'s priority list and returns the first matching presentation format. This means that a single `UnitSystemKey` can match formats from several EC `UnitSystem` elements, providing sensible fallback behavior (e.g., the "metric" group falls back through INTERNATIONAL and FINANCE if a KindOfQuantity does not define an SI-specific format).

EC `UnitSystem` elements not covered by any preference group (e.g. CGS, MARITIME, INDUSTRIAL) will only appear if a KindOfQuantity explicitly references them. Applications that need these systems should implement a custom [FormatsProvider]($quantity).

### Setting the Active Unit System

The active unit system determines which formats are used throughout the application:

```ts
// Set the active unit system
await IModelApp.quantityFormatter.setActiveUnitSystem("metric");

// Get the current unit system
const system = IModelApp.quantityFormatter.activeUnitSystem; // "metric"
```

For more details on unit system configuration, see [Providers — Configuring Unit System](../usage/Providers.md#configuring-unit-system).

## See Also

- [Formats](./Formats.md) - How formats reference and use units
- [EC Phenomenon](../../bis/ec/ec-phenomenon.md) - Phenomenon definitions and dimensional derivations
- [EC UnitSystem](../../bis/ec/ec-unitsystem.md) - EC schema UnitSystem element reference
- [Format Sets](./FormatSets.md) - Application-level format persistence
- [Providers](../usage/Providers.md) - Implementing and registering units providers
- [Unit Conversion](../usage/UnitConversion.md) - How unit conversions are performed
