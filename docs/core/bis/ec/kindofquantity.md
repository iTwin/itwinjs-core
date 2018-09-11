# KindOfQuantity

Describes a strongly typed 'kind' for a property. This kind identifies what is being measured and stored in an ECProperty. This kind is used for grouping like properties, setting units and display formatting, and creating quantity objects in scripts.

Units referenced in a Kind Of Quantity are from the Units 2.0 framework.

## Attributes

**typeName** defines the name of this KindOfQuantity. Must be a valid [ECName](./ec-name.md) and be unique among all other items in a schema.

**description** User facing description of the KindOfQuantity. Localized and may be shown in the UI.

**displayLabel** a localized display label that will be used instead of the name in the GUI. If not set the Type Name of the KindOfQuantity will be used

**persistenceUnit** The unit values of this kind will be stored in

**precision** The number of significant digits values of this kind have. Zero means none set.

**defaultPresentationUnit** The unit used when displaying this kind of value in the UI. Persistence unit used if not set.

**alternativePresentationUnits** A list of other units to show as alternates in the UI. No alternates shown if not set.