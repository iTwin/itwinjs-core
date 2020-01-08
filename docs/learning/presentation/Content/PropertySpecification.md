# Property Overrides Content Modifier

This content modifier allows overriding some attributes of ECProperty.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-
`name` | Yes | `string` | | Name of the ECProperty.
`overridesPriority` | No | `number` | 1000 | Priority of the specified overrides.
`labelOverride` | No | `string` | `undefined` | Label override. May be [localized](../Localization.md).
`categoryId` | No | `string` | `undefined` | ID of a category specified through `PropertyCategorySpecification` in this scope.
`isDisplayed` | No | `boolean` | `undefined` | Display override. `true` to force display, `false` to force hide, `undefined` to use default.
`editor` | No | `PropertyEditorSpecification` | `undefined` | Custom property editor [specification](./PropertyEditorSpecification).

## Examples

```JSON
{
  "name": "MyProperty",
  "overridesPriority": 2000,
  "labelOverride": "Custom Property Label",
  "categoryId": "my_custom_category",
  "isDisplayed": true,
  "editor": {
    "editorName": "custom_editor"
  }
}
```
