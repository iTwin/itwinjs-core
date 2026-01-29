# Quantity Formatting and Parsing

Quantity formatting ensures consistent, user-friendly display of measurements across your application, respecting unit systems and format preferences.

iTwin.js provides quantity formatting through two packages: __@itwin/core-quantity__ for formatting and parsing operations, and __@itwin/ecschema-metadata__ for schema-based format and unit providers. Together, they convert numeric values into formatted display strings with appropriate units, and parse user input strings back into numeric values.

## Getting Started

Quantity formatting is organized into two main areas:

[!iui tile heading="Definitions" linkTo="index path=quantity-formatting/definitions/index subPath=/definitions" contents="Learn about units, formats, and format sets - the specifications that define how quantities are displayed and persisted" icon="measure.svg"]
[!iui tile heading="Usage" linkTo="index path=quantity-formatting/usage/index subPath=/usage" contents="Learn how to apply format definitions at runtime using providers, formatters, and parsers in your iTwin applications" icon="developer.svg"]

## Quick Links

### Core Concepts

- __[Units](./definitions/Units.md)__ - Understanding units, phenomena, and persistence units
- __[Formats](./definitions/Formats.md)__ - Complete FormatProps reference including decimal, fractional, scientific, station, and ratio formats
- __[Format Sets](./definitions/FormatSets.md)__ - Application-level format persistence and overrides

### Implementation

- __[Providers](./usage/Providers.md)__ - Setting up UnitsProvider and FormatsProvider for your application
- __[Parsing and Formatting](./usage/ParsingAndFormatting.md)__ - Using FormatterSpec and ParserSpec to format values and parse user input
- __[Unit Conversion](./usage/UnitConversion.md)__ - How unit conversions work during formatting and parsing operations

### Integration

- __[QuantityFormatter Integration](./usage/ParsingAndFormatting.md#usage-in-itwin-tools-and-components)__ - Integrating with IModelApp.quantityFormatter
- __[Migrating from QuantityType to KindOfQuantity](./usage/ParsingAndFormatting.md#migrating-from-quantitytype-to-kindofquantity)__ - Moving to schema-based formatting

### API Reference

- __[core-quantity API](https://www.itwinjs.org/reference/core-quantity/quantity/)__ - Formatter, Parser, FormatterSpec, ParserSpec classes
- __[ecschema-metadata API](https://www.itwinjs.org/reference/ecschema-metadata/)__ - Format, SchemaUnitProvider, SchemaFormatsProvider classes
