---
publish: false
---

# NextVersion

Table of contents:

- [Tracing API deprecation](#tracing-api-deprecation)
- [Batched tileset enhancements](#batched-tileset-enhancements)
  - [Per-model display settings](#per-model-display-settings)
  - [Support for excluded models](#support-for-excluded-models)

## Tracing API deprecation

As the OpenTelemetry API kept growing, we decided to deprecate the [Tracing]($bentley) class and encourage direct usage of `@opentelemetry/api` instead.

iTwin.js will continue to create spans for RPC requests, and possibly other operations in the future.

## Batched tileset enhancements

The [@itwin/frontend-tiles](https://www.npmjs.com/package/@itwin/frontend-tiles) package used to stream "batched" tilesets produced by the tech preview [mesh export service](https://developer.bentley.com/apis/mesh-export/overview/) received several updates.

After upgrading to the 4.4.0 version of this package, previously-published tilesets will fail to load. You will need to produce new exports using the mesh export service.

### Per-model display settings

A view can customize how a model (or group of models) is displayed in a handful of ways:

- A [ModelDisplayTransformProvider]($frontend) can apply a [Transform]($geometry);
- [ModelClipGroups]($common) can apply different [ClipVector]($geometry)s to different groups of models;
- [PlanProjectionSettings]($common) can apply an elevation transform, override the transparency, and/or cause the geometry to display as an overlay;
- A [RenderSchedule.Script]($common) can apply symbology overrides and rigid animation transforms; and
- [ViewFlagOverrides]($common) stored in the model's `jsonProperties` can override [ViewFlags]($common) like [RenderMode]($common).

These features work fine for the standard tilesets supplied by the iTwin.js backend, which produces one tileset for each model; but not for the tilesets produced by the mesh export service, which batches many models together into a single tileset to improve performance. That has now been [rectified](https://github.com/iTwin/itwinjs-core/pull/6354): per-model display settings are applied to the batched tiles while preserving the performance benefits of batching.

### Support for excluded models

The [mesh export service](https://developer.bentley.com/apis/mesh-export/overview/) batches geometry from many [SpatialModel]($backend)s together into a single tileset to improve performance, but some models are excluded. For example:

- Models marked as "private", indicating they are hidden from pick lists in the user interface and generally not intended to be displayed in normal spatial views
  - These are often used to provide 3d geometry within a [ViewAttachment]($backend).
- Models that contain a URL pointing to a reality model providing their graphical representation.
- "Template" models containing geometry that serves as a template for placing 3d components.

Previously, geometry from these models would fail to display. That has been [rectified](https://github.com/iTwin/itwinjs-core/pull/6270).
