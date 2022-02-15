# Related Properties Specification

> TypeScript type: [RelatedPropertiesSpecification]($presentation-common).

This specification allows including related instance properties into the content.

## Attributes

| Name                                                                              | Required? | Type                                                                                | Default             |
| --------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------- | ------------------- |
| [`propertiesSource`](#attribute-propertiessource)                                 | Yes       | [`RelationshipPathSpecification`](../Common-Rules/RelationshipPathSpecification.md) |                     |
| [`handleTargetClassPolymorphically`](#attribute-handletargetclasspolymorphically) | No        | `boolean`                                                                           | `false`             |
| [`relationshipMeaning`](#attribute-relationshipmeaning)                           | No        | `"SameInstance" \| "RelatedInstance"`                                               | `"RelatedInstance"` |
| [`properties`](#attribute-properties)                                             | No        | `Array<string \| PropertySpecification> \| "_none_" \| "*"`                         | `"*"`               |
| [`autoExpand`](#attribute-autoexpand)                                             | No        | `boolean`                                                                           | `false`             |
| [`skipIfDuplicate`](#attribute-skipifduplicate)                                   | No        | `boolean`                                                                           | `false`             |
| [`nestedRelatedProperties`](#attribute-nestedrelatedproperties)                   | No        | [`RelatedPropertiesSpecification[]`](#related-properties-specification)             | `[]`                |

### Attribute: `propertiesSource`

[Specification of the relationship path](../Common-Rules/RelationshipPathSpecification.md) to follow when looking for related properties.

```ts
[[include:Content.Customization.RelatedPropertiesSpecification.PropertiesSource.Ruleset]]
```

![Example of using the "properties source" attribute](./media/relatedpropertiesspecification-with-propertiessource-attribute.png)

### Attribute: `handleTargetClassPolymorphically`

> **Default value:** `false`

The attribute tells whether the target class specified through [`propertiesSource` attribute](#attribute-propertiessource) should be handled
polymorphically. This means properties of the concrete class are loaded in addition to properties of the target class itself.

```ts
[[include:Content.Customization.RelatedPropertiesSpecification.HandleTargetClassPolymorphically.Ruleset]]
```

| `handleTargetClassPolymorphically: false`                                                                                                                                            | `handleTargetClassPolymorphically: true`                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Example of using "handle target class polymorphically" attribute set to "false"](./media/relatedpropertiesspecification-with-handletargetclasspolymorphically-attribute-false.png) | ![Example of using "handle target class polymorphically" attribute set to "true"](./media/relatedpropertiesspecification-with-handletargetclasspolymorphically-attribute-true.png) |

### Attribute: `relationshipMeaning`

> **Default value:** `"RelatedInstance"`

The attribute describes what the related properties mean to the [primary instance](./Terminology.md#primary-instance) whose properties are
displayed. There are two possible options:

- `RelatedInstance` means that the properties should be distinguished from properties of the [primary instance](./Terminology.md#primary-instance)
  and shown separately to make it clear they belong to another instance. Generally that means they're assigned a separate root category.

- `SameInstance` means that the properties should be displayed as if they belonged to the [primary instance](./Terminology.md#primary-instance). Generally
  that means they assigned a category, that's nested under the default category.

See [property categorization page](./PropertyCategorization.md) page for more details.

```ts
[[include:Content.Customization.RelatedPropertiesSpecification.RelationshipMeaning.Ruleset]]
```

| `relationshipMeaning: "RelatedInstance"`                                                                                                                                      | `relationshipMeaning: "SameInstance"`                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Example of using "relationship meaning" attribute set to "related instance"](./media/relatedpropertiesspecification-with-relationshipMeaning-attribute-relatedinstance.png) | ![Example of using "relationship meaning" attribute set to "same instance"](./media/relatedpropertiesspecification-with-relationshipMeaning-attribute-sameinstance.png) |

### Attribute: `properties`

> **Default value:** `"*"`

List of names or definitions of related class properties that should be included in the content. In addition, a couple of special values are allowed:

- `"_none_"` means none of the properties should be picked up. Generally this is used in combination with the [`nestedRelatedProperties` attribute](#attribute-nestedrelatedproperties).
- `"*"` means all properties should be picked up.

```ts
[[include:Content.Customization.RelatedPropertiesSpecification.Properties.Ruleset]]
```

![Example of using the "properties" attribute](./media/relatedpropertiesspecification-with-properties-attribute.png)

### Attribute: `autoExpand`

> **Default value:** `false`

The attribute specifies whether the field containing related properties should be assigned the [NestedContentField.autoExpand]($presentation-common)
attribute. The attribute tells UI components showing the properties that they should be initially displayed in the expanded state.

```ts
[[include:Content.Customization.RelatedPropertiesSpecification.AutoExpand.Ruleset]]
```

| `autoExpand: false`                                                                                                                    | `autoExpand: true`                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| ![Example of using "auto expand" attribute set to "false"](./media/relatedpropertiesspecification-with-autoexpand-attribute-false.png) | ![Example of using "auto expand" attribute set to "true"](./media/relatedpropertiesspecification-with-autoexpand-attribute-true.png) |

### Attribute: `skipIfDuplicate`

> **Default value:** `false`

The attribute specifies whether the specification should be ignored if it duplicates another higher priority specification for the same relationship.

```ts
[[include:Content.Customization.RelatedPropertiesSpecification.SkipIfDuplicate.Ruleset]]
```

| `skipIfDuplicate: false`                                                                                                                          | `skipIfDuplicate: true`                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Example of using "skip if duplicate" attribute set to "false"](./media/relatedpropertiesspecification-with-skipifduplicate-attribute-false.png) | ![Example of using "skip if duplicate" attribute set to "true"](./media/relatedpropertiesspecification-with-skipifduplicate-attribute-true.png) |

### Attribute: `nestedRelatedProperties`

> **Default value:** `[]`

The attribute allows loading additional related properties that are related to the target instance of this specification.

```ts
[[include:Content.Customization.RelatedPropertiesSpecification.NestedRelatedProperties.Ruleset]]
```

![Example of using the "nested related properties" attribute](./media/relatedpropertiesspecification-with-nestedrelatedproperties-attribute.png)
