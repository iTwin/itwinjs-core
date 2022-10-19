---
publish: false
---

# NextVersion

Table of contents:

- [Electron 17 support](#electron-17-support)
- [IModelSchemaLoader replaced](#imodelschemaloader-replaced)
- [Display](#display)
  - [Ambient occlusion improvements](#ambient-occlusion-improvements)
  - [Improved display transform support](#improved-display-transform-support)
- [Presentation](#presentation)
  - [Restoring presentation tree state](#restoring-presentation-tree-state)
  - [OpenTelemetry](#opentelemetry)
  - [Localization changes](#localization-changes)
- [Geometry](#geometry)
  - [Coplanar facet consolidation](#coplanar-facet-consolidation)
  - [Filling mesh holes](#filling-mesh-holes)
- [Deprecations](#deprecations)
  - [@itwin/core-transformer](#itwincore-transformer)
  - [@itwin/core-geometry](#itwincore-geometry)
- [Geometry](#geometry)

## Electron 17 support

In addition to the already supported Electron 14, iTwin.js now supports Electron versions [15](https://www.electronjs.org/blog/electron-15-0), [16](https://www.electronjs.org/blog/electron-16-0), and [17](https://www.electronjs.org/blog/electron-17-0). At the moment, support for Electron 18 and 19 is blocked due to a [bug in the V8 javascript engine](https://github.com/electron/electron/issues/35043).

## IModelSchemaLoader replaced

The `IModelSchemaLoader` class has been replaced with [SchemaLoader]($ecschema-metadata) for obtaining schemas from an iModel. This allows us to remove the @itwin/ecschema-metadata dependency from @itwin/core-backend.

```typescript
// Old
import { IModelSchemaLoader } from "@itwin/core-backend";
const loader = new IModelSchemaLoader(iModel);
const schema = loader.getSchema("BisCore");

// New
import { SchemaLoader } from "@itwin/ecschema-metadata";
const loader = new SchemaLoader((name) => iModel.getSchemaProps(name); );
const schema = loader.getSchema("BisCore");
```

[SchemaLoader]($ecschema-metadata) can be constructed with any function that returns [ECSchemaProps]($common) when passed a schema name string.

## Display

### Ambient occlusion improvements

The ambient occlusion effect has undergone some quality improvements.

Changes:

- The shadows cast by ambient occlusion will decrease in size the more distant the geometry is.
- The maximum distance for applying ambient occlusion now defaults to 10,000 meters instead of 100 meters.
- The effect will now fade as it approaches the maximum distance.

Old effect, as shown below:

![AO effect is the same strength in the near distance and far distance](./assets/AOOldDistance.png)

New effect, shown below:

![AO effect fades in the distance; shadows decrease in size](./assets/AONewDistance.png)

For more details, see the new descriptions of the `texelStepSize` and `maxDistance` properties of [AmbientOcclusion.Props]($common).

### Improved display transform support

In some cases, geometry is displayed within a [Viewport]($frontend) at a different location, orientation, and/or scale than that with which it is persisted in the iModel. For example:

- A [DisplayStyle]($backend) may use [PlanProjectionSettings.elevation]($common) to adjust a plan projection model's position on the Z axis.
- A [ModelDisplayTransformProvider]($frontend) may supply [Transform]($core-geometry)s to be applied to specific models.
- A [RenderSchedule.Script]($common) may apply [Transform]($core-geometry)s to groups of elements belonging to a [RenderSchedule.ElementTimeline]($common).

Tools that interact both with a [Viewport]($frontend) and with persistent geometry sometimes need to account for such display transforms. Such tools can now use [ViewState.computeDisplayTransform]($frontend) to compute the transform applied to a model or element for display. For example, [AccuSnap]($frontend) applies the display transform to the snap points and curves received from the backend to display them correctly in the viewport; and [ViewClipByElementTool]($frontend) applies it to the element's bounding box to orient the clip with the element as displayed in the viewport.

## Presentation

### Restoring presentation tree state

It is now possible to restore previously saved Presentation tree state on component mount.

```ts
// Save current tree state
const { nodeLoader } = usePresentationTreeNodeLoader(args);
useEffect(() => exampleStoreTreeModel(nodeLoader.modelSource.getModel()), []);

// Restore tree state on component mount
const seedTreeModel = exampleRetrieveStoredTreeModel();
const { nodeLoader } = usePresentationTreeNodeLoader({ ...args, seedTreeModel });
```
### OpenTelemetry

It is now possible to setup OpenTelemetry reporting using `PresentationManagerProps.diagnosticsCallback` attribute.

Example usage:

```ts
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { context, trace } from "@opentelemetry/api";
import { convertToReadableSpans } from "@itwin/presentation-opentelemetry";
import { Presentation } from "@itwin/presentation-backend";

const traceExporter = new OTLPTraceExporter({
  url: "<OpenTelemetry collector's url>",
});

Presentation.initialize({ diagnosticsCallback: (diagnostics) => {
  const parentSpanContext = trace.getSpan(context.active())?.spanContext();
  const spans = convertToReadableSpans(diagnostics, parentSpanContext);
  traceExporter.export(spans, () => {});
} });
```

### Localization Changes

Previously, some of the data produced by the Presentation library was being localized both on the backend. This behavior was dropped in favor of localizing everything on the frontend. As a result, the requirement to supply localization assets with the backend is also removed.

In case of a backend-only application, localization may be setup by providing a [localization function when initializing the Presentation backend](../presentation/advanced/Localization.md).  By default the library localizes known strings to English.

**Deprecated APIs:**

- PresentationManagerProps.localeDirectories
- PresentationManagerProps.defaultLocale
- PresentationManager.activeLocale

## Geometry

### Coplanar facet consolidation

A new method, [PolyfaceQuery.cloneWithMaximalPlanarFacets]($core-geometry), can identify groups of adjacent coplanar facets in a mesh and produce a new mesh in which each group is consolidated into a single facet. The consolidated facets are necessarily not triangular and various bridge edges will be present in non-convex facets.

![maximalPlanarFacets](assets/Geometry-maximalPlanarFacets.png "Mesh with many coplanar facets; new mesh with consolidation of coplanar facets")

### Filling mesh holes

A new method, [PolyfaceQuery.fillSimpleHoles]($core-geometry), can identify holes in a mesh and produce a new mesh in which some or all of the holes are replaced with facets. Which holes are filled can be controlled using [HoleFillOptions]($core-geometry) to specify constraints such as maximum hole perimeter, number of edges, and/or loop direction.

![fillHoles](assets/Geometry-fillHoles.png "Mesh with holes; All boundaries extracted from surface, including outer boundary; Mesh with holes filled")

## Deprecations

### @itwin/core-transformer

The synchronous `void`-returning overload of [IModelTransformer.initFromExternalSourceAspects]($transformer) has been deprecated. It will still perform the old behavior synchronously until it is removed. It will now however return a `Promise` (which should be `await`ed) if invoked with the an [InitFromExternalSourceAspectsArgs]($transformer) argument, which is necessary when processing changes instead of the full source contents.

## Geometry

The B-spline API has several name changes for consistency:

| Deprecated                                                    | Replacement                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------- |
| [BSpline1dNd.testCloseablePolygon]($core-geometry)            | [BSpline1dNd.testClosablePolygon]($core-geometry)             |
| [BSpline2dNd.sumpoleBufferDerivativesForSpan]($core-geometry) | [BSpline2dNd.sumPoleBufferDerivativesForSpan]($core-geometry) |
| [UVSelect.VDirection]($core-geometry)                         | [UVSelect.vDirection]($core-geometry)                         |

In addition, [BSplineSurface3dQuery.isClosable]($core-geometry) and [BSpline2dNd.isClosable]($core-geometry) have a new optional argument to return a [BSplineWrapMode]($core-geometry) enum value classifying the manner in which the surface can be closed (if at all) in the given parametric direction.