# Unit

Defines a Unit of Measure in terms of other Units allowing generation of a conversion factor between it and any other dimensionally compatible unit.  NOTE: Conversions are limited to units in the same Phenomenon.

## Attributes

**typeName** Defines the name of this Unit. Must be a valid [ECName](./ec-name.md) and be unique among all other items in a schema.

**displayLabel** A display label that will be localized and used instead of the name in a GUI. If not set, the typeName is used.

**description** A user-facing description of the Unit. Localized and may be shown in a UI.

**phenomenon** The physical quantity that this unit measures (e.g., length, temperature, pressure).  Only units in the same phenomenon can be converted between.

**unitSystem** The unit system that this unit belongs to (e.g., metric, imperial).

**definition** The expression that defines this unit in terms of other units.  This expression defines the dimensionality of the unit and is used along with the numerator, denominator, and offset to convert between units in the same phenomenon.

**numerator** The numerator for the conversion factor which is used in combination with the units definition to convert between units.

**denominator** The denominator for the conversion factor which is used in combination with the units definition to convert between units.

**offset** The offset applied when converting between units.

# InvertedUnit

Defines a Unit that is the inverse of another Unit.  Only valid for Units whose dimensional derivation is Unit-less (e.g., slope).

## Attributes

**typeName** Defines the name of this Unit. Must be a valid [ECName](./ec-name.md) and be unique among all other items in a schema.

**displayLabel** A localized display label that will be used instead of the name in a GUI. If not set, the name is used.

**description** A user-facing description of the Unit. Localized and may be shown in a UI.

**invertsUnit** The unit this is inverting.

**unitSystem** The UnitSystem this is a member of.