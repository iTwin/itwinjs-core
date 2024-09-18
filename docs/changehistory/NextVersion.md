---
publish: false
---
# NextVersion

Table of contents:

- [Revert timeline changes](#revert-timeline-changes)
- [Calculated properties specification enhancements](#calculated-properties-specification-enhancements)
- [Quantity](#quantity)

### Revert timeline changes

At present, the sole method to reverse a defective changeset is to remove it from the iModel hub, which can lead to numerous side effects. A preferable approach would be to reverse the changeset in the timeline and introduce it as a new changeset. Although this method remains intrusive and necessitates a schema lock, it is safer because it allows for the reversal to restore previous changes, ensuring that nothing is permanently lost from the timeline.

[IModelDb.revertAndPushChanges]($core-backend) Allow to push a single changeset that undo all changeset from tip to specified changeset in history.

Some detail and requirements are as following.

- When invoking the iModel, it must not have any local modifications.
- The operation is atomic; if it fails, the database will revert to its previous state.
- The revert operation necessitates a schema lock (an exclusive lock on the iModel) because it does not lock each individual element affected by the revert.
- If no description is provided after a revert, a default description for the changeset will be created and pushed, which releases the schema lock.
- Schema changes are not reverted during SchemaSync, or they can be optionally skipped when SchemaSync is not utilized.

## Presentation

### Calculated properties specification enhancements

A new optional [`extendedData`]($docs/presentation/content/CalculatedPropertiesSpecification.md#attribute-extendeddata) attribute has been added to [calculated properties specification]($docs/presentation/content/CalculatedPropertiesSpecification.md). The attribute allows associating resulting calculated properties field with some extra information, which may be especially useful for dynamically created calculated properties.

### Quantity

- Add support for 'Ratio' format type (e.g. "1:2")
- Add support for unit inversion during unit conversion

