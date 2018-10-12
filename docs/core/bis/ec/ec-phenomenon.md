# Phenomenon

Defines a type of measurable physical quantity.  Units that belong to the same Phenomenon measure the same type of quantity and can be converted between.  Multiple phenomena may share the same dimensional derivation so long as each measures a different physical quantity.

## Attributes

**typeName** Defines the name of this Phenomenon. Must be a valid [ECName](./ec-name.md) and be unique among all other items in a schema.

**displayLabel** A localized display label that will be used instead of the name in a GUI. If not set, the name is used.

**description** A user-facing description of the Phenomenon. Localized and may be shown in a UI.

**definition** The expression that defines this phenomenon in terms of other phenomena.  This expression defines the dimensionality of the phenomenon and is used to ensure the dimensionality of all units in this phenomenon match.