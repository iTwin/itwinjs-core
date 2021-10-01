# PropertyEditor Specification

> TypeScript type: [PropertyEditorSpecification]($presentation-common).

This specification allows specifying a custom property editor and its parameters.

## Attributes

| Name         | Required? | Type                         | Default | Meaning                    |
| ------------ | --------- | ---------------------------- | ------- | -------------------------- |
| `editorName` | Yes       | `string`                     |         | Name of the custom editor. |
| `parameters` | No        | `PropertyEditorParameters[]` | `[]`    | Parameters for the editor. |

## Parameters

Parameters allow to further customize the chosen editor.

### JSON

The JSON parameters are the most flexible type of editor parameters as they simply allow sending an arbitrary JSON object which the editor receives.

| Name         | Required? | Type     | Default     | Meaning                            |
| ------------ | --------- | -------- | ----------- | ---------------------------------- |
| `paramsType` | Yes       | `"Json"` |             | Type of parameters object.         |
| `json`       | No        | `any`    | `undefined` | Arbitrary JSON sent to the editor. |

### Multiline

Parameters that are intended for text editors that support multi-line display.

| Name         | Required? | Type          | Default | Meaning                    |
| ------------ | --------- | ------------- | ------- | -------------------------- |
| `paramsType` | Yes       | `"Multiline"` |         | Type of parameters object. |
| `height`     | No        | `number`      | `1`     | Number of lines.           |

### Range

Parameters for numeric or date editors that support ranges.

| Name         | Required? | Type      | Default     | Meaning                     |
| ------------ | --------- | --------- | ----------- | --------------------------- |
| `paramsType` | Yes       | `"Range"` |             | Type of parameters object.  |
| `min`        | No        | `number`  | `undefined` | Minimum value of the range. |
| `max`        | No        | `number`  | `undefined` | Maximum value of the range. |

### Slider

Parameters for editors that support slider display.

| Name             | Required? | Type       | Default | Meaning                        |
| ---------------- | --------- | ---------- | ------- | ------------------------------ |
| `paramsType`     | Yes       | `"Slider"` |         | Type of parameters object.     |
| `min`            | Yes       | `number`   |         | Minimum value that can be set. |
| `max`            | Yes       | `number`   |         | Maximum value that can be set. |
| `intervalsCount` | No        | `number`   | `1`     | Count of intervals.            |
| `isVertical`     | No        | `boolean`  | `false` | Is slider vertical.            |

## Example

```JSON
{
  "editorName": "Slider",
  "parameters": [{
    "paramsType": "Slider",
    "min": 0,
    "max": 100
  }]
}
```
