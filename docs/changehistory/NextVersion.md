---
publish: false
---
# NextVersion

<!-- prettier-ignore -->
- [NextVersion](#nextversion)
  - [Frontend](#frontend)
    - [Linked iModels](#linked-imodels)
    - [ViewState property updates](#viewstate-property-updates)
  - [API deprecations](#api-deprecations)
    - [HitDetail feature identity](#hitdetail-feature-identity)
    - [Viewport display APIs](#viewport-display-apis)

## Frontend

### Linked iModels

Spatial views can display linked iModels, each with its own visibility, display overrides, and feature override providers. Use [IModelDisplayReferenceFeatureOverrideProvider]($frontend) or [EmphasizeIModelElements]($frontend) to provide reference-specific symbology or emphasis. See [Referencing Linked iModels](../learning/LinkedIModels.md) for details.

### ViewState property updates

The `categorySelector`, `modelSelector`, and `displayStyle` setters remain supported. Prefer updating selector contents instead of replacing selectors, and use `cloneWithDisplayStyle` to create a view with a different display style.

## API deprecations

### HitDetail feature identity

The [HitDetailProps]($frontend) interface is deprecated in favor of [HitDetailFeatureProps]($frontend).

### Viewport display APIs

Viewport-level APIs for model and category display overrides, viewed models, and always/never-drawn elements are deprecated in favor of APIs on [IModelDisplayReference]($frontend) and [SpatialIModelDisplayReference]($frontend).
