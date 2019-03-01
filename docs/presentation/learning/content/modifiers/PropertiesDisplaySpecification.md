# PropertiesDisplay Content Modifier

This content modifier allows hiding or showing specific properties.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-|-
`propertyNames` | Yes | `string[]` | | List of ECProperty names which should be hidden or shown.
`isDisplayed` | No | `boolean` | `true` | Should properties be displayed.
`priority` | No | `number` | `1000` | Controls priority of the specification. Higher priority means the specification takes precedence.

## Example

```JSON
{
  "priority": 9999,
  "propertyNames": ["Width", "Height", "Depth"],
  "isDisplayed": false
}
```
