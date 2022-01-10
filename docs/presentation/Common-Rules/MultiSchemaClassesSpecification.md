# Multi Schema Classes Specification

> TypeScript type: [MultiSchemaClassesSpecification]($presentation-common).

The specification is used to specify which and how ECClasses should be targeted when creating content or hierarchy nodes. The primary purpose of this specification is to provide a way to define a group of target classes.

## Attributes

| Name                                          | Required? | Type                                                                  | Default |
| --------------------------------------------- | --------- | --------------------------------------------------------------------- | ------- |
| [`schemaName`](#attribute-schemaname)         | Yes       | `string`                                                              |   ""    |
| [`classNames`](#attribute-classnames)         | Yes       | `string[]`                                                            |  `[]`   |
| [`arePolymorphic`](#attribute-arepolymorphic) | No        | `boolean`                                                             | `false` |

### Attribute: `schemaName`

Defines the name of the schema where target classes are located.

### Attribute: `classNames`

An array of target ECClass names.

### Attribute: `arePolymorphic`

> **Default value:** `false`

Defines whether the derived ECClasses should be included in the result.

## Example

```ts
[[include:ContentInstancesOfSpecificClasses.MultiSchemaClasses.Ruleset]]
```
