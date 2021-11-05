# Custom property value renderers

Data in [PropertyGrid]($components-react) and [Table]($components-react) components is displayed by property value renderers. By defining and registering custom renderers, users can extend property rendering system to support new data types and UI interactions.

## Available renderers

($presentation-components) library already registers the following custom value renderers:

| Renderer                                             | `rendererName`       |
| ---------------------------------------------------- | -------------------- |
| [InstanceKeyValueRenderer]($presentation-components) | `SelectableInstance` |

To use these or any other custom renderers, specify which renderer to invoke for specific properties using Presentation Rules:

```json
{
  "ruleType": "ContentModifier",
  "propertyOverrides": [
    {
      "name": "<property name>",
      "renderer": {
        "rendererName": "<custom renderer name>"
      }
    }
  ]
}
```

## Adding a custom renderer

A new custom property value renderer can be added by registering a class implementing [IPropertyValueRenderer]($components-react) to the [PropertyValueRendererManager]($components-react).
