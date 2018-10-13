# KindOfQuantity

Describes a strongly typed *kind* for a property. This kind identifies what is being measured and stored in an ECProperty. It is used for grouping like properties, setting units and display formatting, and creating quantity objects in scripts.

## Attributes

**typeName** Defines the name of this KindOfQuantity. Must be a valid [ECName](./ec-name.md) and be unique among all other items in a schema.

**description** A user-facing description of the KindOfQuantity. Localized and may be shown in a UI.

**displayLabel** A localized display label that will be used instead of the name in a GUI. If not set the Type Name of the KindOfQuantity will be used.

**persistenceUnit** The unit values of this kind will be stored in.

**relativeError** The number of significant digits values of this kind have. Zero means none set.

**defaultPresentationFormat** The [Format](./ec-format.md) used when displaying this kind of value in the UI. The persistence unit with a default format is used if not set.

**alternativePresentationFormats** A list of additional formats available to show in the UI.
