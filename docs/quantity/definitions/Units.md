# Units

Units are the foundational building blocks for quantity formatting and parsing. Understanding how units work, how they're organized, and how conversions are performed is essential for working with quantity formatting in iTwin.js.

## Common Terms

- **Unit** - A named unit of measure which can be located by its name or label. The definition of any unit is represented through its [UnitProps]($quantity).

- **Unit Family/[Phenomenon]($ecschema-metadata)** - A physical quantity that can be measured (e.g., length, temperature, pressure). Only units in the same phenomenon can be converted between each other.

- **Persistence Unit** - The unit used to store a quantify a value in memory or to persist the value in an editable [iModel](../../learning/iModels.md). iModels define the persistence unit through [KindOfQuantity]($docs/bis/ec/kindofquantity/) objects.

## Units Provider

The [UnitsProvider]($quantity) interface is central to unit management in iTwin.js. Providers locate units, retrieve unit properties, and generate conversion specifications between units.

For detailed information about units providers and their usage, see [Providers](../usage/Providers.md).

## Unit Families and Phenomena

Units are grouped into families based on the physical quantity they measure. This grouping is called a **Phenomenon** in EC terminology. Key characteristics:

- Units in the same phenomenon can be converted between each other
- Units in different phenomena cannot be converted (e.g., length to temperature)
- Common phenomena include: LENGTH, ANGLE, AREA, VOLUME, TIME, TEMPERATURE, PRESSURE

Understanding phenomena is crucial when:

- Defining composite formats (all units must be in the same phenomenon)
- Parsing user input (parser only considers units in the same phenomenon as the target)
- Creating custom formats

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

## See Also

- [Formats](./Formats.md) - How formats reference and use units
- [Format Sets](./FormatSets.md) - Application-level format persistence
- [Providers](../usage/Providers.md) - Implementing and registering units providers
- [Unit Conversion](../usage/UnitConversion.md) - How unit conversions are performed
