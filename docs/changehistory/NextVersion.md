---
publish: false
---
# NextVersion

Table of contents:

- [Display](#display)
  - [Tile decoding in workers](#tile-decoding-in-workers)
  - [Smaller edge encoding](#smaller-edge-encoding)
- [Presentation](#presentation)
 - [Renderer, editor and category on calculated properties](#renderer-editor-and-category-on-calculated-properties)
 - [Class property categories under custom custom categories](#class-property-categories-under-custom-categories)

## Display

### Tile decoding in workers

Producing a responsive web app requires [limiting](https://web.dev/off-main-thread/) the amount of JavaScript code executing on the main thread. To that end, we have [moved](https://github.com/iTwin/itwinjs-core/pull/5548) decoding of [tile content](https://www.itwinjs.org/learning/display/tiles/) to a worker. This helps to reduce stutter when loading a large number of tiles. We plan to move more code to workers in upcoming releases.

### Smaller edge encoding

When rendering the contents of a view with [edge display](https://www.itwinjs.org/learning/display/edgedisplay/) enabled, special [tiles](https://www.itwinjs.org/learning/display/tiles/) are requested that encode the edge geometry in addition to the surfaces. A tile containing edges can be many times bigger than the same tile containing only surfaces. iTwin.js 4.1 introduces a [new encoding scheme](https://github.com/iTwin/itwinjs-core/pull/5581) that reduces that size difference by an order of magnitude. Previously, the average tile containing edges weighed 73% more than the corresponding tile without edges; now, the average difference is only 6.7%. This reduces tile transmission times and memory usage when edge display is enabled.

## Presentation

### Renderer, editor and category on calculated properties

Previously, the [calculated properties specification](../presentation/content/CalculatedPropertiesSpecification.md) only allowed specifying property [label](../presentation/content/CalculatedPropertiesSpecification.md#attribute-label) and [value](../presentation/content/CalculatedPropertiesSpecification.md#attribute-value). Now the specification has an ability to assign [renderer](../presentation/content/CalculatedPropertiesSpecification.md#attribute-renderer), [editor](../presentation/content/CalculatedPropertiesSpecification.md#attribute-editor) and [category](../presentation/content/CalculatedPropertiesSpecification.md#attribute-categoryid) to calculated properties.

### Class property categories under custom categories

Now when moving property into a different category using [`categoryId`](../presentation/content/PropertySpecification.md#attribute-categoryid), [IdCategoryIdentifier]($presentation-common) has a new attribute `createClassCategory` which specifies whether an additional class category should be created under the category pointed to by the [IdCategoryIdentifier.categoryId]($presentation-common) or not. See [property categorization](../presentation/content/PropertyCategorization.md#creating-class-categories-under-custom-ones) for more details.