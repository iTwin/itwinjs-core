# Property editor specification

> TypeScript type: [PropertyEditorSpecification]($presentation-common).

This specification allows assigning a custom property editor to specific properties.

## Attributes

| Name                                  | Required? | Type     | Default |
| ------------------------------------- | --------- | -------- | ------- |
| [`editorName`](#attribute-editorname) | Yes       | `string` |         |

### Attribute: `editorName`

Name of the property editor that's going to be used in UI components. This name is carried over to
[Field.editor]($presentation-common) and it's up to the UI component to make sure appropriate editor
is used to edit the property.

|                 |          |
| --------------- | -------- |
| **Type**        | `string` |
| **Is Required** | Yes      |

```ts
[[include:Presentation.Content.Customization.PropertySpecification.Editor.Ruleset]]
```

```ts
[[include:Presentation.Content.Customization.PropertySpecification.Editor.Result]]
```
