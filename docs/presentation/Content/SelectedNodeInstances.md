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
| [`onlyIfNotHandled`](#attribute-onlyifnothandled)                   | No        | boolean                                                                             | `false` |
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

Filter selected nodes by specified schema name. All schemas are accepted if not specified.

```ts
[[include:SelectedNodeInstances.AcceptableSchemaName.Ruleset]]
```

  | Selected input                  | Result                                                                                                          |
  | ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
  | `BisCore.SpatialViewDefinition` | ![Example when selecting `SpatialViewDefinition`](./media/selectednodeinstances-with-spatialviewdefinition.png) |
  | `Generic.GroupModel`            | ![Example when selecting `GroupModel`](./media/content-empty-table.png)                                         |


### Attribute: `acceptableClassNames`

Filter selected nodes by specified class names. All classes are accepted if not specified.

```ts
[[include:SelectedNodeInstances.AcceptableClassNames.Ruleset]]
```

  | Selected input                  | Result                                                                                                          |
  | ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
  | `BisCore.SpatialViewDefinition` | ![Example when selecting `SpatialViewDefinition`](./media/selectednodeinstances-with-spatialviewdefinition.png) |
  | `BisCore.DictionaryModel`       | ![Example when selecting `DictionaryModel`](./media/content-empty-table.png)                                    |

### Attribute: `acceptablePolymorphically`

Should `acceptableClassNames` property be checked polymorphically. If true, all derived classes are accepted as well.

```ts
[[include:SelectedNodeInstances.AcceptablePolymorphically.Ruleset]]
```

  | Selected input                  | Result                                                                                                        |
  | ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
  | `BisCore.DictionaryModel`       | ![Example when selecting `DictionaryModel`](./media/selectednodeinstances-with-acceptablepolymorphically.png) |
  | `BisCore.SpatialViewDefinition` | ![Example when selecting `SpatialViewDefinition`](./media/content-empty-table.png)                            |

### Attribute: `onlyIfNotHandled`

> **Default value:** `false`

Identifies whether we should ignore this specification if another specification was already handled (based on rule priorities and definition order). Should be used when defining a fallback specification.

```ts
[[include:SharedAttributes.OnlyIfNotHandled.Ruleset]]
```

  | onlyIfNotHandled | Result                                                                                                         |
  | ---------------- | -------------------------------------------------------------------------------------------------------------- |
  | `true`           | ![Example when selecting all instances](./media/contentinstancesofspecificclasses-with-onlyifnothandled-1.png) |
  | `false`          | ![Example when filtering instances](./media/contentinstancesofspecificclasses-with-onlyifnothandled-2.png)     |

### Attribute: `priority`

> **Default value:** `1000`

Defines the order in which specifications are handled - higher priority means the specifications is handled first. If priorities are equal, the specifications are handled in the order they're defined.

```ts
[[include:SharedAttributes.Priority.Ruleset]]
```

![Example of using priority attribute](./media/contentinstancesofspecificclasses-with-priority.png)

### Attribute: `relatedProperties`

Specifications of [related properties](./RelatedPropertiesSpecification.md) which are included in the generated content.

```ts
[[include:SharedAttributes.RelatedProperties.Ruleset]]
```

  | without related properties                                                                                           | with related properties                                                                                              |
  | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
  | ![Example when doing normal property select](./media/contentinstancesofspecificclasses-with-relatedproperties-1.png) | ![Example when doing normal property select](./media/contentinstancesofspecificclasses-with-relatedproperties-2.png) |

### Attribute: `calculatedProperties`

Specifications of [calculated properties](./CalculatedPropertiesSpecification.md) whose values are generated using provided [ECExpressions](../Advanced/ECExpressions.md#ecinstance).

```ts
[[include:SharedAttributes.CalculatedProperties.Ruleset]]
```

![Example of using calculatedProperties attribute](./media/contentinstancesofspecificclasses-with-calculatedproperties.png)

### Attribute: `propertyCategories`

Specifications of [custom categories](PropertyCategorySpecification.md).

Simply defining the categories does nothing - they have to be referenced through [`PropertySpecification.categoryId`](./PropertySpecification.md) specified in [`propertyOverrides`](#attribute-propertyoverrides) list.

```ts
[[include:SharedAttributes.PropertyCategories.Ruleset]]
```

![Example of using propertyCategories attribute](./media/contentinstancesofspecificclasses-with-propertycategories.png)

### Attribute: `propertyOverrides`

Specifications of various [property overrides](./PropertySpecification.md) that allow customizing individual properties display.

```ts
[[include:SharedAttributes.PropertyOverrides.Ruleset]]
```

  |        | Result                                                                                                                    |
  | ------ | ------------------------------------------------------------------------------------------------------------------------- |
  | before | ![Example when doing normal property select](./media/contentinstancesofspecificclasses-with-propertyoverrides-1.png)      |
  | after  | ![Example when selecting with related properties](./media/contentinstancesofspecificclasses-with-propertyoverrides-2.png) |

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

  |                                                                   | Result                                                                                                                                                 |
  | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `SpatialViewDefinition` instances                                 | ![A list of spatial view definitions](./media/contentinstancesofspecificclasses-with-relatedinstances-3.png)                                           |
  | `ModelSelector` instances                                         | ![A list of model selectors](./media/contentinstancesofspecificclasses-with-relatedinstances-2.png)                                                    |
  | `ModelSelector` instances filtered by `SpatialViewDefinition.Yaw` | ![A list of model selectors filtered by yaw of related spatial view definition](./media/contentinstancesofspecificclasses-with-relatedinstances-1.png) |

## Example

```JSON
{
  "specType": "SelectedNodeInstances",
  "acceptableSchemaName": "MySchema",
  "acceptableClassNames": ["MyClass1", "MyClass2"],
  "acceptablePolymorphically": true
}
```
