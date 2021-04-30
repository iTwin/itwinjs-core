# Property Overrides Content Modifier

> Based on [PropertySpecification]($presentation-common) interface.

This content modifier allows overriding some attributes of ECProperty.

## Attributes

| Name                                        | Required? | Type                          | Default     | Meaning                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------- | --------- | ----------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                                      | Yes       | `string`                      |             | Name of the ECProperty. A `"*"` may be specified to match all properties in current context.                                                                                                                                                                                                                        |
| `overridesPriority`                         | No        | `number`                      | 1000        | Priority of the specified overrides.                                                                                                                                                                                                                                                                                |
| `labelOverride`                             | No        | `string`                      | `undefined` | Label override. May be [localized](../Localization.md).                                                                                                                                                                                                                                                             |
| `categoryId`                                | No        | `string`                      | `undefined` | ID of a category specified through `PropertyCategorySpecification` in this scope.                                                                                                                                                                                                                                   |
| `isDisplayed`                               | No        | `boolean`                     | `undefined` | Display override. `true` to force display, `false` to force hide, `undefined` to use default.                                                                                                                                                                                                                       |
| `renderer`                                  | No        | `CustomRendererSpecification` | `undefined` | Custom property renderer specification.                                                                                                                                                                                                                                                                             |
| `editor`                                    | No        | `PropertyEditorSpecification` | `undefined` | Custom [property editor specification](./PropertyEditorSpecification).                                                                                                                                                                                                                                              |
| `doNotHideOtherPropertiesOnDisplayOverride` | No        | `boolean`                     | `undefined` | Flag to control behavior of `isDisplayed` override when it's set to `true`. By default, forcing property display hides all other properties. Setting `doNotHideOtherPropertiesOnDisplayOverride` to true disables that behavior and prevents forcing property display of one property from hiding other properties. |

## Examples

```JSON
{
  "name": "MyProperty",
  "overridesPriority": 2000,
  "labelOverride": "Custom Property Label",
  "categoryId": "my_custom_category",
  "isDisplayed": true,
  "renderer": {
    "rendererName": "custom_renderer"
  },
  "editor": {
    "editorName": "custom_editor"
  },
  "doNotHideOtherPropertiesOnDisplayOverride": true
}
```
