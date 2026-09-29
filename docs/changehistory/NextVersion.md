---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [Backend](#backend)
    - [Quantity formatting for text annotation fields](#quantity-formatting-for-text-annotation-fields)

## Backend

### Quantity formatting for text annotation fields

[FieldRun]($common)s whose target property resolves to a `"quantity"` or `"coordinate"` value are now rendered through the standard iTwin.js quantity formatting pipeline instead of the previous placeholder `toString()` representation. By default each KindOfQuantity is presented using the format its schema declares, in the metric unit system. An application can adopt its own [FormatSet]($ecschema-metadata)s for an iModel via the new [ElementDrivesTextAnnotation.registerFieldFormatting]($backend), and individual fields can override the KindOfQuantity, persistence unit, or FormatSet used to format them.

Two changes need attention when upgrading:

- Any numeric property carrying a KindOfQuantity previously rendered as a bare number and now renders as a formatted quantity, with no opt-in required: a `double` persisting 2.5 m renders as `2.5 m` instead of `2.5`, and an `int` persisting 2500 mm under a KindOfQuantity presenting meters changes from `2500` to `2.5 m`. Persisted [FieldRun.cachedContent]($common) is updated the next time the source element is edited.
- `@itwin/core-quantity` is now a **peer dependency** of `@itwin/core-backend`. Most applications already list it, since packages such as `@itwin/core-frontend` and `@itwin/core-ecschema-metadata` depend on it too. If yours does not, add it at the same version as the rest of your iTwin.js core packages.

See [Quantity formatting for text annotation fields](../learning/backend/TextAnnotationFields.md) for a walkthrough covering format resolution, registration lifetime, and evaluating fields.
