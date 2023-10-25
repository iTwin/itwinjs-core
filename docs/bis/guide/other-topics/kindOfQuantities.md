# KindOfQuantities in BIS

The choosing of a [KindOfQuantity](../../ec/kindofquantity.md) in a BIS schema needs to reflect the intended level of coordination of the grouping of properties and default display-formatting that it represents. In general, there are three levels of coordination to keep in mind:

1. Common across the BIS ecosystem.
1. Common across a particular subset of schemas.
1. Specific to an iModel Connector or Application.

## Common KindOfQuantities across the BIS ecosystem

KindOfQuantities defined in the [AecUnits](../../domains/AecUnits.ecschema.md) schema shall be referenced by properties whose grouping and default display-formatting are meant to be coordinated across the entire BIS ecosystem, disregarding of the disciplines involved.

As an example, the aecu:LENGTH `KindOfQuantity` can be referenced by properties in schemas at any layer. If the display-formatting of aecu:LENGTH is changed in an Application, the new display-formatting will apply to values from properties across all disciplines referencing it.

## Common KindOfQuantities across a subset of schemas

When the coordination about grouping of properties and default-formatting is only expected among properties in a subset of schemas, it is recommended that a separate schema is introduced to define them.

The [RoadRailUnits](../../domains/RoadRailUnits.ecschema.md) schema is an example of this kind of coordination. For instance, it defines a rru:LENGTH KindOfQuantity that is referenced by properties in Road & Rail schemas whose display-formatting is expected to change together and differs from the settings specified in the common aecu:LENGTH KindOfQuantity mentioned earlier. That is, aecu:LENGTH lists four possible display units: meters, millimeters, feet-inches and feet-only, but the list of display units that are typically used in Road & Rail domains is different - meters, feet and survey-feet.

## Specific to an iModel Connector or Application

When an iModel Connector or Application faces the need of a special `KindOfQuantity` not covered by existing lower-level schemas, such special `KindOfQuantity` shall be defined in a Connector or Application-specific schema. It is still recommended to introduce these special KindOfQuantities into a separate schema in order to achieve better scoping and control over schema upgrades. That way display-format settings captured in a separate KindOfQuantity-oriented schema can be tweaked without forcing a change on an actual domain schema.

---
| Next: [BIS Schema Validation](./bis-schema-validation.md)
|:---
