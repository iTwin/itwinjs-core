# Selected node instances specification

> TypeScript type: [SelectedNodeInstancesSpecification]($presentation-common).

Returns content for selected (input) instances.

## Attributes

| Name                                                                | Required? | Type                                                                            | Default |
| ------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------- | ------- |
| *Filtering*                                                         |
| [`acceptableSchemaName`](#attribute-acceptableschemaname)           | No        | `string`                                                                        | `""`    |
| [`acceptableClassNames`](#attribute-acceptableclassnames)           | No        | `string[]`                                                                      | `[]`    |
| [`acceptablePolymorphically`](#attribute-acceptablepolymorphically) | No        | `boolean`                                                                       | `false` |
| [`onlyIfNotHandled`](#attribute-onlyifnothandled)                   | No        | `boolean`                                                                       | `false` |
| *Ordering*                                                          |
| [`priority`](#attribute-priority)                                   | No        | `number`                                                                        | `1000`  |
| *Content Modifiers*                                                 |
| [`relatedProperties`](#attribute-relatedproperties)                 | No        | [`RelatedPropertiesSpecification[]`](./RelatedPropertiesSpecification.md)       | `[]`    |
| [`calculatedProperties`](#attribute-calculatedproperties)           | No        | [`CalculatedPropertiesSpecification[]`](./CalculatedPropertiesSpecification.md) | `[]`    |
| [`propertyCategories`](#attribute-propertycategories)               | No        | [`PropertyCategorySpecification[]`](./PropertyCategorySpecification.md)         | `[]`    |
| [`propertyOverrides`](#attribute-propertyoverrides)                 | No        | [`PropertySpecification[]`](./PropertySpecification.md)                         | `[]`    |
| *Misc.*                                                             |
| [`relatedInstances`](#attribute-relatedinstances)                   | No        | [`RelatedInstanceSpecification[]`](../RelatedInstanceSpecification.md)          | `[]`    |

### Attribute: `acceptableSchemaName`

Specifies ECSchema name which the input instances have to match for the specification to be used.

|                   |                                    |
| ----------------- | ---------------------------------- |
| **Type**          | `string`                           |
| **Is Required**   | No                                 |
| **Default Value** | Schemas with any name are accepted |

```ts
[[include:Presentation.SelectedNodeInstances.AcceptableSchemaName.Ruleset]]
```

| Selected input                  | Result                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `BisCore.SpatialViewDefinition` | ![Example when selecting "SpatialViewDefinition"](./media/selectednodeinstances-with-spatialviewdefinition.png) |
| `Generic.GroupModel`            | ![Example when selecting "GroupModel"](./media/content-empty-table.png)                                         |

### Attribute: `acceptableClassNames`

Specifies a list of class names which the input instances have to match for the specification to be used.

|                   |                                    |
| ----------------- | ---------------------------------- |
| **Type**          | `string[]`                         |
| **Is Required**   | No                                 |
| **Default Value** | Classes with any name are accepted |

```ts
[[include:Presentation.SelectedNodeInstances.AcceptableClassNames.Ruleset]]
```

| Selected input                  | Result                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `BisCore.SpatialViewDefinition` | ![Example when selecting "SpatialViewDefinition"](./media/selectednodeinstances-with-spatialviewdefinition.png) |
| `BisCore.DictionaryModel`       | ![Example when selecting "DictionaryModel"](./media/content-empty-table.png)                                    |

### Attribute: `acceptablePolymorphically`

Specifies whether derived classes of [acceptableClassNames](#attribute-acceptableclassnames) should be included in the content.

|                   |           |
| ----------------- | --------- |
| **Type**          | `boolean` |
| **Is Required**   | No        |
| **Default Value** | `false`   |

```ts
[[include:Presentation.SelectedNodeInstances.AcceptablePolymorphically.Ruleset]]
```

|                                    | Result                                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `acceptablePolymorphically: true`  | ![Example of "acceptable polymorphically" attribute set to "true"](./media/selectednodeinstances-with-spatialviewdefinition.png) |
| `acceptablePolymorphically: false` | ![Example of "acceptable polymorphically" attribute set to "false"](./media/content-empty-table.png)                             |

### Attribute: `onlyIfNotHandled`

When `true`, the specification takes effect only when all other specifications with higher priority are ruled out. This attribute is most useful for defining fallback specifications.

|                   |           |
| ----------------- | --------- |
| **Type**          | `boolean` |
| **Is Required**   | No        |
| **Default Value** | `false`   |

```ts
[[include:Presentation.SharedAttributes.OnlyIfNotHandled.Ruleset]]
```

|                           | Result                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `onlyIfNotHandled: true`  | ![Example using both specifications](./media/sharedattributes-with-onlyifnothandled-1.png)                 |
| `onlyIfNotHandled: false` | ![Example with "only if not handled" specifications](./media/sharedattributes-with-onlyifnothandled-2.png) |

### Attribute: `priority`

Controls the order in which specifications are handled — specification with higher priority value is handled first. If priorities are equal, the specifications are handled in the order they appear in the ruleset.

|                   |          |
| ----------------- | -------- |
| **Type**          | `number` |
| **Is Required**   | No       |
| **Default Value** | `1000`   |

```ts
[[include:Presentation.SharedAttributes.Priority.Ruleset]]
```

![Example of using "priority" attribute](./media/sharedattributes-with-priority.png)

### Attribute: `relatedProperties`

Specifications of [related properties](./RelatedPropertiesSpecification.md) which are included in the generated content.

|                   |                                                                           |
| ----------------- | ------------------------------------------------------------------------- |
| **Type**          | [`RelatedPropertiesSpecification[]`](./RelatedPropertiesSpecification.md) |
| **Is Required**   | No                                                                        |
| **Default Value** | `[]`                                                                      |

```ts
[[include:Presentation.SharedAttributes.RelatedProperties.Ruleset]]
```

| `relatedProperties: []`                                                                             | `relatedProperties` as defined in the above ruleset                                                        |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| ![Example when doing normal property select](./media/sharedattributes-with-relatedproperties-1.png) | ![Example when selecting with "related properties"](./media/sharedattributes-with-relatedproperties-2.png) |

### Attribute: `calculatedProperties`

Specifications of [calculated properties](./CalculatedPropertiesSpecification.md) whose values are generated using provided [ECExpressions](../advanced/ECExpressions.md#ecinstance).

|                   |                                                                                 |
| ----------------- | ------------------------------------------------------------------------------- |
| **Type**          | [`CalculatedPropertiesSpecification[]`](./CalculatedPropertiesSpecification.md) |
| **Is Required**   | No                                                                              |
| **Default Value** | `[]`                                                                            |

```ts
[[include:Presentation.SharedAttributes.CalculatedProperties.Ruleset]]
```

![Example of using "calculated properties" attribute](./media/sharedattributes-with-calculatedproperties.png)

### Attribute: `propertyCategories`

Defines a list of [custom categories](PropertyCategorySpecification.md).

Custom categories are not present in the result unless they contain at least one property. To assign a property to the category, reference its `id` in [`PropertySpecification.categoryId`](./PropertySpecification.md) when defining [`propertyOverrides`](#attribute-propertyoverrides).

|                   |                                                                         |
| ----------------- | ----------------------------------------------------------------------- |
| **Type**          | [`PropertyCategorySpecification[]`](./PropertyCategorySpecification.md) |
| **Is Required**   | No                                                                      |
| **Default Value** | `[]`                                                                    |

```ts
[[include:Presentation.SharedAttributes.PropertyCategories.Ruleset]]
```

![Example of using "property categories" attribute](./media/sharedattributes-with-propertycategories.png)

### Attribute: `propertyOverrides`

Specifications of various [property overrides](./PropertySpecification.md) that allow customizing individual properties display.

|                   |                                                         |
| ----------------- | ------------------------------------------------------- |
| **Type**          | [`PropertySpecification[]`](./PropertySpecification.md) |
| **Is Required**   | No                                                      |
| **Default Value** | `[]`                                                    |

```ts
[[include:Presentation.SharedAttributes.PropertyOverrides.Ruleset]]
```

|                                                     | Result                                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `propertyOverrides: []`                             | ![Example when doing normal property select](./media/sharedattributes-with-propertyoverrides-1.png)        |
| `propertyOverrides` as defined in the above ruleset | ![Example when selecting with "property overrides"](./media/sharedattributes-with-propertyoverrides-2.png) |

### Attribute: `relatedInstances`

Specifications of [related instances](../RelatedInstanceSpecification.md) that can be used when creating the content. There are several use cases when this is useful:

- When there's a need to only load instances that have a related instance. Providing a [related instance](../RelatedInstanceSpecification.md)
  specification with [isRequired](../RelatedInstanceSpecification.md#attribute-isrequired) set to `true` filters-out the instances that don't have the related instance.

- When there's a need to filter instances by a related instance value. The [alias](../RelatedInstanceSpecification.md#attribute-alias) attribute may then be used
  in the [`instanceFilter` attribute](#attribute-instancefilter) to reference related instance property values.

- When there's a need to customize content based on related instance property values. Related instance classes are included when looking for [customization rules](../customization/index.md),
  which allows referencing related instances and their properties in [customization rule ECExpressions](../customization/ECExpressions.md#override-value) by their
  [alias](../RelatedInstanceSpecification.md#attribute-alias).

|                   |                                                                        |
| ----------------- | ---------------------------------------------------------------------- |
| **Type**          | [`RelatedInstanceSpecification[]`](../RelatedInstanceSpecification.md) |
| **Is Required**   | No                                                                     |
| **Default Value** | `[]`                                                                   |

```ts
[[include:Presentation.SharedAttributes.RelatedInstances.Ruleset]]
```

|                                                                   | Result                                                                                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `SpatialViewDefinition` instances                                 | ![A list of spatial view definitions](./media/sharedattributes-with-relatedinstances-3.png)                                           |
| `ModelSelector` instances                                         | ![A list of model selectors](./media/sharedattributes-with-relatedinstances-2.png)                                                    |
| `ModelSelector` instances filtered by `SpatialViewDefinition.Yaw` | ![A list of model selectors filtered by yaw of related spatial view definition](./media/sharedattributes-with-relatedinstances-1.png) |
