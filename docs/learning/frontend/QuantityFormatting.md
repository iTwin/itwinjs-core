# QuantityFormatter

The [QuantityFormatter]($frontend) is a class that formats quantity values. This class is used on the front-end to format quantities for interactive tools, such as the different measure tools. The Quantity Formatter is not used to format properties stored in the iModel as that is work is done on the back-end via the Presentation layer. The QuantityFormatter can be set to format values in the same unit system as that being used by the back-end.

## QuantityType

There are nine built-in quantity types, see [QuantityType]($frontend). The QuantityFormatter defines default formatting specification for each of these types per unit system. Custom quantity types that implement the [CustomQuantityTypeDefinition]($frontend) interface may also be registered with the QuantityFormatter, see method `registerQuantityType`.

### Overriding Default Formats

The `QuantityFormat` provides the method `setOverrideFormats` to allow the default format to be overridden. A class the implements the [UnitFormattingSettingsProvider]($frontend) interface can be set with the QuantityFormatter to persist the overrides set. This provider can then monitor the current session to load the overrides when necessary. The class [LocalUnitFormatProvider]($frontend) can be set using the following to register to store settings to local storage and to maintain overrides by iModel.

```ts
    await IModelApp.quantityFormatter.setUnitFormattingSettingsProvider(new LocalUnitFormatProvider(IModelApp.quantityFormatter, true));
```

This allows both the Presentation Unit System and the format overrides, set by the user, to stay in sync as the user opens different iModels.

## Measure Tools

Below are a list of a few of the delivered Measure Tools and the QuantityTypes they use.

### MeasureDistanceTool

- Length - QuantityType.Length
- Coordinates - QuantityType.Coordinate

### MeasureLocationTool

- Coordinates - QuantityType.Coordinate
- Spatial Coordinates - QuantityType.LatLong
- Height - QuantityType.Coordinate

### MeasureAreaByPointsTool

- Perimeter - QuantityType.Length
- Coordinates - QuantityType.Coordinate
- Area - QuantityType.Area

### MeasureElementTool

- Accumulated Length - QuantityType.Length
- Accumulated Area - QuantityType.Area
- Volume - QuantityType.Volume
- Centroid - QuantityType.Coordinate
