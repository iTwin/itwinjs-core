# Multi Schema Classes Specification

> TypeScript type: [MultiSchemaClassesSpecification]($presentation-common).

This specification lists ECClasses which should be targeted when creating content or hierarchy nodes.

## Attributes

| Name                                          | Required? | Type       | Default |
| --------------------------------------------- | --------- | ---------- | ------- |
| [`schemaName`](#attribute-schemaname)         | Yes       | `string`   | `""`    |
| [`classNames`](#attribute-classnames)         | Yes       | `string[]` | `[]`    |
| [`arePolymorphic`](#attribute-arepolymorphic) | No        | `boolean`  | `false` |

### Attribute: `schemaName`

Specifies the schema which contains the target classes.

### Attribute: `classNames`

An array of target ECClass names.

### Attribute: `arePolymorphic`

> **Default value:** `false`

Defines whether the derived ECClasses should be included in the result.

## Example

```ts
[[include:ContentInstancesOfSpecificClasses.MultiSchemaClasses.Ruleset]]
```
