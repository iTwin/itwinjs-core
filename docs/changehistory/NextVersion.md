---
publish: false
---
# NextVersion

Table of contents:

- [Snapping within view attachments](#snapping-within-view-attachments)
- [Display](#display)
  - [Tile decoding in workers](#tile-decoding-in-workers)
  - [Smaller edge encoding](#smaller-edge-encoding)
- [Presentation](#presentation)
 - [Renderer, editor and category on calculated properties](#renderer-editor-and-category-on-calculated-properties)

## Snapping within view attachments

[SheetViewDefinition]($backend)s can include the contents of other views by way of [ViewAttachment]($backend)s. It has always been possible to locate and interact with elements inside of a view attachment, but [now](https://github.com/iTwin/itwinjs-core/pull/5633) you can also snap to their geometry while doing so. This is useful, for example, for measuring distances between elements inside of the attachment. Additionally, when locating elements on a sheet - whether or not snapping is enabled - information about the view attachment is included.

When a locate operation identifies an element inside of a view attachment, the attachment's element Id can be obtained via [HitDetail.viewAttachment]($frontend). If you are using [Viewport.readPixels]($frontend), the Id will be included in [Pixel.Data]($frontend). All world coordinates (e.g., [HitDetail.hitPoint]($frontend)) will be in the *sheet* model's coordinate space. You can pass the attachment Id to [ViewState.computeDisplayTransform]($frontend) to obtain the [Transform]($core-geometry) from the view attachment's coordinate space to the sheet.

Note: most view attachments are two-dimensional drawings or orthographic spatial views. Attachments of perspective (camera) views do not support locating elements inside them, nor snapping to them.

## Display

### Tile decoding in workers

Producing a responsive web app requires [limiting](https://web.dev/off-main-thread/) the amount of JavaScript code executing on the main thread. To that end, we have [moved](https://github.com/iTwin/itwinjs-core/pull/5548) decoding of [tile content](https://www.itwinjs.org/learning/display/tiles/) to a worker. This helps to reduce stutter when loading a large number of tiles. We plan to move more code to workers in upcoming releases.

### Smaller edge encoding

When rendering the contents of a view with [edge display](https://www.itwinjs.org/learning/display/edgedisplay/) enabled, special [tiles](https://www.itwinjs.org/learning/display/tiles/) are requested that encode the edge geometry in addition to the surfaces. A tile containing edges can be many times bigger than the same tile containing only surfaces. iTwin.js 4.1 introduces a [new encoding scheme](https://github.com/iTwin/itwinjs-core/pull/5581) that reduces that size difference by an order of magnitude. Previously, the average tile containing edges weighed 73% more than the corresponding tile without edges; now, the average difference is only 6.7%. This reduces tile transmission times and memory usage when edge display is enabled.

## Presentation

### Renderer, editor and category on calculated properties

Previously, the [calculated properties specification](../presentation/content/CalculatedPropertiesSpecification.md) only allowed specifying property [label](../presentation/content/CalculatedPropertiesSpecification.md#attribute-label) and [value](../presentation/content/CalculatedPropertiesSpecification.md#attribute-value). Now the specification has an ability to assign [renderer](../presentation/content/CalculatedPropertiesSpecification.md#attribute-renderer), [editor](../presentation/content/CalculatedPropertiesSpecification.md#attribute-editor) and [category](../presentation/content/CalculatedPropertiesSpecification.md#attribute-categoryid) to calculated properties.

