---
publish: false
---

# NextVersion

Table of contents:

- [Tracing API deprecation](#tracing-api-deprecation)
- [Batched tileset enhancements](#batched-tileset-enhancements)
  - [Per-model display settings](#per-model-display-settings)
  - [Support for excluded models](#support-for-excluded-models)
- [Geometry](#geometry)
  - [Range tree search](#range-tree-search)
  - [Polyface adjacent facet queries](#polyface-adjacent-facet-queries)

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

## Geometry

### Range tree search

New efficient range tree methods [PolyfaceRangeTreeContext.searchForClosestPoint]($core-geometry) and [PolyfaceRangeTreeContext.searchForClosestApproach]($core-geometry) support searches of a [Polyface]($core-geometry) for the closest facet point to a given space point, and searches of two Polyfaces for the segment spanning their closest approach. New classes [Point3dArrayRangeTreeContext]($core-geometry) and [LineString3dRangeTreeContext]($core-geometry) provide similar functionality for searching [Point3d]($core-geometry) arrays and [LineString3d]($core-geometry) objects, respectively.

### Polyface adjacent facet queries

- Conventional polyface data defines each facet by a sequence of indices of point coordinates "around the facet"
- These indices do not indicate what facet is adjacent "across each edge of the facet"
- new method [IndexedPolyface.buildEdgeMateIndices] constructs indices for the cross-edge relationship.
- Following that construction, the following queries support navigation around each facet, around each vertex, and across each edge:
  - polyface.readIndexToEdgeMate = (possibly undefined) readIndex of the edge mate.
  - polyface.readIndexToSuccessorAroundFacet = readIndex of the next vertex around the facet.
  - polyface.readIndexToPredecessorAroundFacet = readIndex of the previous vertex around the facet
  - polyface.readIndexToSuccessorAroundVertex = (possibly undefined) readIndex of the next vertex around the facet.
  - polyface.readIndexToPredecessorAroundVertex = (possibly undefined) readIndex of the previous vertex around the facet
