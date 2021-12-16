# MultiSchemaClasses Specification

> TypeScript type: [MultiSchemaClassesSpecification]($presentation-common).

Multi schema classes are used to specify which ECClasses should be targeted when generating display content or hierarchy nodes. The primary purpose of this specification is to provide a way of defining multiple target classes from different schemas.

## Attributes

| Name                                          | Required? | Type                                                                  | Default |
| --------------------------------------------- | --------- | --------------------------------------------------------------------- | ------- |
| [`schemaName`](#attribute-schemaname)         | Yes       | `string`                                                              |   ""    |
| [`classNames`](#attribute-classnames)         | Yes       | `string[]`                                                            |  `[]`   |
| [`arePolymorphic`](#attribute-arepolymorphic) | No        | `boolean`                                                             | `false` |

### Attribute: `schemaName`

Defines the name of the schema where target classes are located.

### Attribute: `classNames`

An array of names for all target ECCLasses.

### Attribute: `arePolymorphic`

Defines whether the derived ECClasses should be included in the result.

## Example

```JSON
{
  {
    "schemaName": "BisCore",
    "classNames": ["Element", "Model"],
    "arePolymorphic": false
  },
}
```
