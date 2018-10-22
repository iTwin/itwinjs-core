# Constant

Defines a constant that can be referenced in a Unit's definition.

## Attributes

**typeName** Defines the name of this Constant. Must be a valid [ECName](./ec-name.md) and be unique among all other items in a schema.

**displayLabel** A localized display label that will be used instead of the name in a GUI. If not set, the name is used.

**description** A user-facing description of the Constant. Localized and may be shown in a UI.

**phenomenon** The physical quantity that this unit measures (e.g., length, temperature, pressure).  Only units in the same phenomenon can be converted between.

**definition** The expression that defines the unit this constant's factor is measured in.

**numerator** The numerator for the constant value being defined.

**denominator** The denominator for the constant value being defined.