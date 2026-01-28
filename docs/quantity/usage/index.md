# Usage

This section covers how to apply format definitions at runtime in iTwin.js applications. These topics focus on the practical implementation of quantity formatting and parsing using providers, formatters, and parsers.

## Overview

Runtime usage involves:

- **Providing formats**: Using format providers to supply format definitions
- **Converting units**: Applying unit conversions between persistence and display units
- **Formatting values**: Converting numeric values to formatted strings
- **Parsing strings**: Converting user input strings back to numeric values

## Topics

This section is organized by developer persona and common workflows:

### [Providers](./Providers.md)

**For Application Developers** - Essential for setting up formatting infrastructure

Learn about UnitsProvider and FormatsProvider implementations, including BasicUnitsProvider, SchemaUnitProvider, SchemaFormatsProvider, MutableFormatsProvider, and FormatSetFormatsProvider. Covers how to register and configure providers during application initialization or when an iModel is opened.

### [Parsing and Formatting](./ParsingAndFormatting.md)

**For Library/Tool Developers** - Core concepts for building reusable components

Deep dive into FormatterSpec and ParserSpec usage, parser behavior and error handling, and how iTwin tools and components use these specs for formatting values for display and parsing user input. Includes integration patterns with [QuantityFormatter]($frontend) and examples from measure tools.

### [Unit Conversion](./UnitConversion.md)

**For All Developers** - Understanding the conversion layer is not mandatory, but informative and helps developers who want to retrieve unit conversions values

Understand how UnitConversionSpec works and how unit conversions are performed between persistence units and display units during formatting and parsing operations.

## Additional Resources

- **[QuantityFormatting (Outdated)](./QuantityFormatting-old.md)** - Previous documentation version for frontend iTwin applications, retained for reference

## See Also

- [Definitions](../definitions/index.md) - Understanding format specifications
- [Formats](../definitions/Formats.md) - Format property reference
- [Format Sets](../definitions/FormatSets.md) - Application-level format persistence
