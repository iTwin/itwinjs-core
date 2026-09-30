---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [Backend](#backend)
    - [Text annotation fields can read values from JSON properties](#text-annotation-fields-can-read-values-from-json-properties)

## Backend

### Text annotation fields can read values from JSON properties

A [FieldRun]($common) can now display a value stored inside a string property that holds serialized JSON, such as `JsonProperties`. Set the new `@beta` [FieldPropertyPath.jsonAccessors]($common) to the object keys and array indices to follow once [FieldPropertyPath.propertyName]($common) and [FieldPropertyPath.accessors]($common) have reached a string property of extended type `Json`:

```ts
[[include:TextFields_JsonAccessors]]
```

The JSON property may be nested; `accessors` walks the EC properties to the JSON property and `jsonAccessors` walks the parsed JSON:

```ts
[[include:TextFields_NestedJsonAccessors]]
```

The path must end on a string, number, or boolean; a path that ends on an object, an array, or a JSON `null` resolves to no value and the field displays [FieldRun.invalidContentIndicator]($common). A numeric leaf is treated as a `"quantity"` and currently renders as its raw number.
