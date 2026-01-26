# Definitions

This section covers the foundational concepts for defining and persisting quantity formats in iTwin.js applications. Understanding these definitions is essential before implementing format providers or performing quantity formatting operations.

## Overview

Format definitions describe _what_ formats are and how they're structured, independent of their runtime usage. These specifications can be:

- Stored in EC schemas and retrievable through [KindOfQuantity](../../bis/ec/kindofquantity.md), defined as presentation units
- Defined as runtime configuration (via [FormatSet]($quantity)) to override EC schema-defined formats
- Defined programmatically (via [FormatProps]($quantity))

## When to Read This Section

- **Understanding format specifications**: Learn how formats are defined and what properties control their behavior
- **Configuring format persistence**: Set up FormatSets for runtime format storage
- **Working with schemas**: Understand how KindOfQuantity relates to format definitions
- **Defining custom formats**: Create FormatProps for specific formatting requirements

## Topics

### [Units](./Units.md)

Learn about units of measure, unit families (phenomena), persistence units, and how units are organized and converted. Essential for understanding format specifications.

### [Formats](./Formats.md)

Deep dive into [FormatProps]($quantity) - the complete specification for how quantity values are displayed. Covers format types (decimal, fractional, scientific), composite formats, station formatting, and format traits. See also the EC schema [Format](../../bis/ec/ec-format.md) reference for schema-level format definitions, the basis of [FormatProps]($quantity).

### [Format Sets](./FormatSets.md)

Understand format persistence through [FormatSet]($quantity), which maps [KindOfQuantity](../../bis/ec/kindofquantity.md) names to [FormatDefinition]($quantity)s. Learn how FormatSets enable format overrides and unit system configuration.

## See Also

- [Usage](../usage/index.md) - How to apply these definitions at runtime
- [Providers](../usage/Providers.md) - Implementations that provide format definitions
- [EC Format](../../bis/ec/ec-format.md) - Schema-level format definitions
- [KindOfQuantity](../../bis/ec/kindofquantity.md) - Schema-level quantity type definitions
