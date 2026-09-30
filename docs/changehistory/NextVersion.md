---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [Backend](#backend)
    - [Text annotation fields can read values from JSON properties](#text-annotation-fields-can-read-values-from-json-properties)
    - [Quantity formatting for text annotation fields](#quantity-formatting-for-text-annotation-fields)

## Backend

### Text annotation fields can read values from JSON properties

A [FieldRun]($common) can now display a value stored inside a string property that holds serialized JSON, such as `JsonProperties`. Set the new `@beta` [FieldPropertyPath.jsonAccessors]($common) to the object keys and array indices to follow once [FieldPropertyPath.propertyName]($common) and [FieldPropertyPath.accessors]($common) have reached a string property of extended type `Json`:

```ts
const field = FieldRun.create({
  propertyHost: { elementId, schemaName: "BisCore", className: "PhysicalElement" },
  propertyPath: { propertyName: "JsonProperties", jsonAccessors: ["contactInfo", "email"] },
});
```

The JSON property may be nested, for example `{ propertyName: "spouse", accessors: ["jsonProperties"], jsonAccessors: ["phoneNumbers", 0, "areaCode"] }`. The path must end on a string, number, or boolean; a path that ends on an object, an array, or a JSON `null` resolves to no value and the field displays [FieldRun.invalidContentIndicator]($common). A numeric leaf is treated as a `"quantity"`; it has no KindOfQuantity of its own, so it renders as its raw number unless the field supplies both `kindOfQuantity` and `persistenceUnit` in its format options (see below).

### Quantity formatting for text annotation fields

[FieldRun]($common)s whose target property resolves to a `"quantity"` or `"coordinate"` value are now rendered through the standard iTwin.js quantity formatting pipeline instead of the previous placeholder `toString()` representation. By default each KindOfQuantity is presented using the format its schema declares, in the metric unit system. An application can adopt its own [FormatSet]($ecschema-metadata)s for an iModel via the new [ElementDrivesTextAnnotation.registerFieldFormatting]($backend), and individual fields can override the KindOfQuantity, persistence unit, or FormatSet used to format them.

Two changes need attention when upgrading:

- Any numeric property carrying a KindOfQuantity previously rendered as a bare number and now renders as a formatted quantity, with no opt-in required: a `double` persisting 2.5 m renders as `2.5 m` instead of `2.5`, and an `int` persisting 2500 mm under a KindOfQuantity presenting meters changes from `2500` to `2.5 m`. Persisted [FieldRun.cachedContent]($common) is updated the next time the source element is edited.
- `@itwin/core-quantity` is now a **peer dependency** of `@itwin/core-backend`. Most applications already list it, since packages such as `@itwin/core-frontend` and `@itwin/core-ecschema-metadata` depend on it too. If yours does not, add it at the same version as the rest of your iTwin.js core packages.

See [Quantity formatting for text annotation fields](../learning/backend/TextAnnotationFields.md) for a walkthrough covering format resolution, registration lifetime, and evaluating fields.
