# Selected Node Instances Specification

> TypeScript type: [SelectedNodeInstancesSpecification]($presentation-common).

Returns content for selected (input) instances.

## Attributes

| Name                                                                | Required? | Type                                                                                | Default |
| ------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------- | ------- |
| *Filtering*                                                         |
| [`acceptableSchemaName`](#attribute-acceptableschemaname)           | No        | `string`                                                                            | `""`    |
| [`acceptableClassNames`](#attribute-acceptableclassnames)           | No        | `string[]`                                                                          | `[]`    |
| [`acceptablePolymorphically`](#attribute-acceptablepolymorphically) | No        | `boolean`                                                                           | `false` |
| [`onlyIfNotHandled`](#attribute-onlyifnothandled)                   | No        | `boolean`                                                                           | `false` |
| *Ordering*                                                          |
| [`priority`](#attribute-priority)                                   | No        | `number`                                                                            | `1000`  |
| *Content Modifiers*                                                 |
| [`relatedProperties`](#attribute-relatedproperties)                 | No        | `RelatedPropertiesSpecification[]`                                                  | `[]`    |
| [`calculatedProperties`](#attribute-calculatedproperties)           | No        | `CalculatedPropertiesSpecification[]`                                               | `[]`    |
| [`propertyCategories`](#attribute-propertycategories)               | No        | `PropertyCategorySpecification[]`                                                   | `[]`    |
| [`propertyOverrides`](#attribute-propertyoverrides)                 | No        | `PropertySpecification[]`                                                           | `[]`    |
| [`showImages`](#attribute-showimages)                               | No        | `boolean`                                                                           | `false` |
| *Misc.*                                                             |
| [`relatedInstances`](#attribute-relatedinstances)                   | No        | [`RelatedInstanceSpecification[]`](../Common-Rules/RelatedInstanceSpecification.md) | `[]`    |

### Attribute: `acceptableSchemaName`

> **Default behaviour:** All schema names accepted

Specifies ECSchema name which the input instances have to match for the specification to be used.

```ts
[[include:SelectedNodeInstances.AcceptableSchemaName.Ruleset]]
```

  | Selected input                  | Result                                                                                                          |
  | ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
  | `BisCore.SpatialViewDefinition` | ![Example when selecting "SpatialViewDefinition"](./media/selectednodeinstances-with-spatialviewdefinition.png) |
  | `Generic.GroupModel`            | ![Example when selecting "GroupModel"](./media/content-empty-table.png)                                         |


### Attribute: `acceptableClassNames`

> **Default behaviour:** All class names accepted

Specifies a list of class names which the input instances have to match for the specification to be used.

```ts
[[include:SelectedNodeInstances.AcceptableClassNames.Ruleset]]
```

  | Selected input                  | Result                                                                                                          |
  | ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
  | `BisCore.SpatialViewDefinition` | ![Example when selecting "SpatialViewDefinition"](./media/selectednodeinstances-with-spatialviewdefinition.png) |
  | `BisCore.DictionaryModel`       | ![Example when selecting "DictionaryModel"](./media/content-empty-table.png)                                    |

### Attribute: `acceptablePolymorphically`

> **Default value:** `false`

Specifies whether derived classes of `acceptableClassNames` should be included in the content.

```ts
[[include:SelectedNodeInstances.AcceptablePolymorphically.Ruleset]]
```

  | Selecting `BisCore.ViewDefinition` input with `acceptablePolymorphically` set to | Result                                                                                                                                      |
  | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
  | `true`                                                                           | ![Example of "acceptable polymorphically" attribute set to "true"](./media/selectednodeinstances-with-spatialviewdefinition.png) |
  | `false`                                                                          | ![Example of "acceptable polymorphically" attribute set to "false"](./media/content-empty-table.png)                                                    |

### Attribute: `onlyIfNotHandled`

> **Default value:** `false`

Specifies whether this specification should be ignored if another specification was handled before as determined by rule and specification priorities. This provides a mechanism for defining a fallback specification.

```ts
[[include:SharedAttributes.OnlyIfNotHandled.Ruleset]]
```

  | onlyIfNotHandled | Result                                                                                                     |
  | ---------------- | ---------------------------------------------------------------------------------------------------------- |
  | `true`           | ![Example using both specifications](./media/sharedattributes-with-onlyifnothandled-1.png)                 |
  | `false`          | ![Example with "only if not handled" specifications](./media/sharedattributes-with-onlyifnothandled-2.png) |

### Attribute: `priority`

> **Default value:** `1000`

Controls the order in which specifications are handled — specification with higher priority value is handled first. If priorities are equal, the specifications are handled in the order they appear in the ruleset.

```ts
[[include:SharedAttributes.Priority.Ruleset]]
```

![Example of using "priority" attribute](./media/sharedattributes-with-priority.png)

### Attribute: `relatedProperties`

Specifications of [related properties](./RelatedPropertiesSpecification.md) which are included in the generated content.

```ts
[[include:SharedAttributes.RelatedProperties.Ruleset]]
```

  | without related properties                                                                          | with related properties                                                                                    |
  | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
  | ![Example when doing normal property select](./media/sharedattributes-with-relatedproperties-1.png) | ![Example when selecting with "related properties"](./media/sharedattributes-with-relatedproperties-2.png) |

### Attribute: `calculatedProperties`

Specifications of [calculated properties](./CalculatedPropertiesSpecification.md) whose values are generated using provided [ECExpressions](../Advanced/ECExpressions.md#ecinstance).

```ts
[[include:SharedAttributes.CalculatedProperties.Ruleset]]
```

![Example of using "calculated properties" attribute](./media/sharedattributes-with-calculatedproperties.png)

### Attribute: `propertyCategories`

Defines a list of [custom categories](PropertyCategorySpecification.md).

Custom categories are not present in the result unless they contain at least one property. To assign a property to the category, reference its `id` in [`PropertySpecification.categoryId`](./PropertySpecification.md) when defining [`propertyOverrides`](#attribute-propertyoverrides).

```ts
[[include:SharedAttributes.PropertyCategories.Ruleset]]
```

![Example of using "property categories" attribute](./media/sharedattributes-with-propertycategories.png)

### Attribute: `propertyOverrides`

Specifications of various [property overrides](./PropertySpecification.md) that allow customizing individual properties display.

```ts
[[include:SharedAttributes.PropertyOverrides.Ruleset]]
```

  |        | Result                                                                                                     |
  | ------ | ---------------------------------------------------------------------------------------------------------- |
  | before | ![Example when doing normal property select](./media/sharedattributes-with-propertyoverrides-1.png)        |
  | after  | ![Example when selecting with "property overrides"](./media/sharedattributes-with-propertyoverrides-2.png) |

### Attribute: `showImages`

> **Default value:** `false`

Should image IDs be calculated for the returned instances. When `true`, [ImageIdOverride](../customization/ImageIdOverride.md) rules get applied when creating the content.

### Attribute: `relatedInstances`

Specifications of [related instances](../Common-Rules/RelatedInstanceSpecification.md) that can be used when creating the content. There are several use cases when this is useful:

- When there's a need to only load instances that have a related instance. Providing a [related instance](../Common-Rules/RelatedInstanceSpecification.md)
  specification with [isRequired](../Common-Rules/RelatedInstanceSpecification.md) set to `true` filters-out the instances that don't have the related instance.

- When there's a need to filter instances by a related instance value. The [alias](../Common-Rules/RelatedInstanceSpecification.md) attribute may then be used
  in the [`instanceFilter` attribute](#attribute-instancefilter) to reference related instance property values.

- When there's a need to customize content based on related instance property values. Related instance classes are included when looking for [customization rules](../Customization/index.md),
  which allows referencing related instances and their properties in [customization rule ECExpressions](../Customization/ECExpressions.md#override-value) by their
  [alias](../Common-Rules/RelatedInstanceSpecification.md).

```ts
[[include:SharedAttributes.RelatedInstances.Ruleset]]
```

  |                                                                   | Result                                                                                                                                |
  | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
  | `SpatialViewDefinition` instances                                 | ![A list of spatial view definitions](./media/sharedattributes-with-relatedinstances-3.png)                                           |
  | `ModelSelector` instances                                         | ![A list of model selectors](./media/sharedattributes-with-relatedinstances-2.png)                                                    |
  | `ModelSelector` instances filtered by `SpatialViewDefinition.Yaw` | ![A list of model selectors filtered by yaw of related spatial view definition](./media/sharedattributes-with-relatedinstances-1.png) |