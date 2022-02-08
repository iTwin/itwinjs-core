# Related Instance Specification

> TypeScript type: [RelatedInstanceSpecification]($presentation-common).

Related instance specification is used in [content](../Content/ContentRule.md#attribute-specifications) and
[hierarchy](../Hierarchies/ChildNodeRule.md#attribute-specifications) specifications to "join" the primary instance
with its related instance and allow using the related instance for:

- [Filtering](#using-related-instances-in-instance-filter), when used in `instanceFilter`.
- [Customization](#using-related-instances-for-customizing), when used in [customization rules](../Customization/index.md).
- [Grouping](#using-related-instances-for-grouping), when used in [grouping rules](../Hierarchies/GroupingRule.md).

## Attributes

| Name                                             | Required? | Type                                                                  | Default |
| ------------------------------------------------ | --------- | --------------------------------------------------------------------- | ------- |
| [`relationshipPath`](#attribute-relationshipath) | Yes       | [`RelationshipPathSpecification`](./RelationshipPathSpecification.md) |         |
| [`alias`](#attribute-alias)                      | Yes       | `string`                                                              |         |
| [`isRequired`](#attribute-isrequired)            | No        | `boolean`                                                             | `false` |

### Attribute: `relationshipPath`

Specifies a chain of [relationship path specifications](./RelationshipPathSpecification.md) that forms a path from the primary instance to the related instances.

### Attribute: `alias`

Specifies an an alias that given to the related instance. The alias can be used to reference the instance in instance filter and customization rules.

> **Note:** The value must be unique per hierarchy specification. If there are multiple related instance specifications using the same alias, the
> library uses the first one and ignores the rest of them.

### Attribute: `isRequired`

> **Default value:** `false`

Specifies whether the related instance is required to exist. If `true`, primary instance won't be returned if the related instance doesn't exist.
In SQL terms in can be compared to INNER JOIN (`isRequired: true`) vs OUTER JOIN (`isRequired: false`).

## Examples

### Using related instances in instance filter

```ts
[[include:RelatedInstanceSpecification.UsingInInstanceFilter.Ruleset]]
```

|                         | Result                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| without instance filter | ![Example without instance filter](./media/relatedinstancespecification-usage-in-instancefilter-1.png) |
| with instance filter    | ![Example with instance filter](./media/relatedinstancespecification-usage-in-instancefilter-2.png)    |

### Using related instances for customizing

```ts
[[include:RelatedInstanceSpecification.UsingForCustomization.Ruleset]]
```

```ts
[[include:RelatedInstanceSpecification.UsingForCustomization.Result]]
```

### Using related instances for grouping

```ts
[[include:RelatedInstanceSpecification.UsingForGrouping.Ruleset]]
```

|                                        | Result                                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| without related instance specification | ![Example without related instance specification](./media/relatedinstancespecification-usage-for-grouping-1.png) |
| with related instance specification    | ![Example with related instance specification](./media/relatedinstancespecification-usage-for-grouping-2.png)    |
