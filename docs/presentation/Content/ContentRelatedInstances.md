# Content Related Instances Specification

> TypeScript type: [ContentRelatedInstancesSpecification]($presentation-common).

Returns content for instances related to the selected (input) instances.

## Attributes

| Name                                                      | Required? | Type                                                                                         | Default |
| --------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------- | ------- |
| *Filtering*                                               |
| [`relationshipPaths`](#attribute-relationshippaths)       | Yes       | [`RepeatableRelationshipPathSpecification[]`](../RepeatableRelationshipPathSpecification.md) |
| [`instanceFilter`](#attribute-instancefilter)             | No        | [ECExpression](./ECExpressions.md#instance-filter)                                           | `""`    |
| [`onlyIfNotHandled`](#attribute-onlyifnothandled)         | No        | `boolean`                                                                                    | `false` |
| *Ordering*                                                |
| [`priority`](#attribute-priority)                         | No        | `number`                                                                                     | `1000`  |
| *Content Modifiers*                                       |
| [`relatedProperties`](#attribute-relatedproperties)       | No        | `RelatedPropertiesSpecification[]`                                                           | `[]`    |
| [`calculatedProperties`](#attribute-calculatedproperties) | No        | `CalculatedPropertiesSpecification[]`                                                        | `[]`    |
| [`propertyCategories`](#attribute-propertycategories)     | No        | `PropertyCategorySpecification[]`                                                            | `[]`    |
| [`propertyOverrides`](#attribute-propertyoverrides)       | No        | `PropertySpecification[]`                                                                    | `[]`    |
| *Misc.*                                                   |
| [`relatedInstances`](#attribute-relatedinstances)         | No        | [`RelatedInstanceSpecification[]`](../RelatedInstanceSpecification.md)                       | `[]`    |

### Attribute: `relationshipPaths`

Specifies a chain of [relationship path specifications](../RepeatableRelationshipPathSpecification.md) that forms a path from an input instance to the output instances. When this array is empty, the specification produces no results.

```ts
[[include:Presentation.ContentRelatedInstances.RelationshipPaths.Ruleset]]
```

The following is a result of selecting one instance of `bis.Model` as input for the ruleset above:

![Example of using "relationship paths" attribute](./media/contentrelatedinstances-with-relationshippaths.png)

### Attribute: `instanceFilter`

Specifies an [ECExpression](./ECExpressions.md#instance-filter) for filtering instances of ECClasses targeted through the [`relationshipPaths` attribute](#attribute-relationshippaths).

```ts
[[include:Presentation.ContentRelatedInstances.InstanceFilter.Ruleset]]
```

  |                | Result                                                                                      |
  | -------------- | ------------------------------------------------------------------------------------------- |
  | without filter | ![Example when selecting all instances](./media/sharedattributes-with-instancefilter-1.png) |
  | with filter    | ![Example when filtering instances](./media/sharedattributes-with-instancefilter-2.png)     |

### Attribute: `onlyIfNotHandled`

> **Default value:** `false`

Identifies whether we should ignore this specification if another specification was already handled (based on rule priorities and definition order). Should be used when defining a fallback specification.

```ts
[[include:Presentation.SharedAttributes.OnlyIfNotHandled.Ruleset]]
```

  | onlyIfNotHandled | Result                                                                                                     |
  | ---------------- | ---------------------------------------------------------------------------------------------------------- |
  | `true`           | ![Example using both specifications](./media/sharedattributes-with-onlyifnothandled-1.png)                 |
  | `false`          | ![Example with "only if not handled" specifications](./media/sharedattributes-with-onlyifnothandled-2.png) |

### Attribute: `priority`

> **Default value:** `1000`

Controls the order in which specifications are handled — specification with higher priority value is handled first. If priorities are equal, the specifications are handled in the order they appear in the ruleset.

```ts
[[include:Presentation.SharedAttributes.Priority.Ruleset]]
```

![Example of using "priority" attribute](./media/sharedattributes-with-priority.png)

### Attribute: `relatedProperties`

Specifications of [related properties](./RelatedPropertiesSpecification.md) which are included in the generated content.

```ts
[[include:Presentation.SharedAttributes.RelatedProperties.Ruleset]]
```

  | without related properties                                                                          | with related properties                                                                                    |
  | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
  | ![Example when doing normal property select](./media/sharedattributes-with-relatedproperties-1.png) | ![Example when selecting with "related properties"](./media/sharedattributes-with-relatedproperties-2.png) |

### Attribute: `calculatedProperties`

Specifications of [calculated properties](./CalculatedPropertiesSpecification.md) whose values are generated using provided [ECExpressions](../Advanced/ECExpressions.md#ecinstance).

```ts
[[include:Presentation.SharedAttributes.CalculatedProperties.Ruleset]]
```

![Example of using "calculated properties" attribute](./media/sharedattributes-with-calculatedproperties.png)

### Attribute: `propertyCategories`

Defines a list of [custom categories](PropertyCategorySpecification.md).

Custom categories are not present in the result unless they contain at least one property. To assign a property to the category, reference its `id` in [`PropertySpecification.categoryId`](./PropertySpecification.md) when defining [`propertyOverrides`](#attribute-propertyoverrides).

```ts
[[include:Presentation.SharedAttributes.PropertyCategories.Ruleset]]
```

![Example of using "property categories" attribute](./media/sharedattributes-with-propertycategories.png)

### Attribute: `propertyOverrides`

Specifications of various [property overrides](./PropertySpecification.md) that allow customizing individual properties display.

```ts
[[include:Presentation.SharedAttributes.PropertyOverrides.Ruleset]]
```

  |        | Result                                                                                                     |
  | ------ | ---------------------------------------------------------------------------------------------------------- |
  | before | ![Example when doing normal property select](./media/sharedattributes-with-propertyoverrides-1.png)        |
  | after  | ![Example when selecting with "property overrides"](./media/sharedattributes-with-propertyoverrides-2.png) |

### Attribute: `relatedInstances`

Specifications of [related instances](../RelatedInstanceSpecification.md) that can be used when creating the content. There are several use cases when this is useful:

- When there's a need to only load instances that have a related instance. Providing a [related instance](../RelatedInstanceSpecification.md)
  specification with [isRequired](../RelatedInstanceSpecification.md#attribute-isrequired) set to `true` filters-out the instances that don't have the related instance.

- When there's a need to filter instances by a related instance value. The [alias](../RelatedInstanceSpecification.md#attribute-alias) attribute may then be used
  in the [`instanceFilter` attribute](#attribute-instancefilter) to reference related instance property values.

- When there's a need to customize content based on related instance property values. Related instance classes are included when looking for [customization rules](../Customization/index.md),
  which allows referencing related instances and their properties in [customization rule ECExpressions](../Customization/ECExpressions.md#override-value) by their
  [alias](../RelatedInstanceSpecification.md#attribute-alias).

```ts
[[include:Presentation.SharedAttributes.RelatedInstances.Ruleset]]
```

  |                                                                   | Result                                                                                                                                |
  | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
  | `SpatialViewDefinition` instances                                 | ![A list of spatial view definitions](./media/sharedattributes-with-relatedinstances-3.png)                                           |
  | `ModelSelector` instances                                         | ![A list of model selectors](./media/sharedattributes-with-relatedinstances-2.png)                                                    |
  | `ModelSelector` instances filtered by `SpatialViewDefinition.Yaw` | ![A list of model selectors filtered by yaw of related spatial view definition](./media/sharedattributes-with-relatedinstances-1.png) |

## Deprecated attributes

### Attribute: `showImages`

> **Default value:** `false`

Should image IDs be calculated for the returned instances. When `true`, [ImageIdOverride](../customization/ImageIdOverride.md) rules get applied when creating the content.

[ExtendedDataRule](../customization/ExtendedDataRule.md) should be used instead to provide image data to content items created by this specification. See [extended data usage page](../customization/ExtendedDataUsage.md) for more details.
