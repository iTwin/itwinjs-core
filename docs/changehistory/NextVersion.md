---
publish: false
---

# NextVersion

Table of contents:

- [Ambient Occlusion Improvements](#ambient-occlusion-improvements)
- [Transformer API](#transformer-api)
- [Presentation](#presentation)
  - [Restoring Presentation tree state](#restoring-presentation-tree-state)
  - [OpenTelemetry](#opentelemetry)
- [Electron versions support](#electron-versions-support)

## Ambient Occlusion Improvements

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

## Transformer API

The synchronous `void`-returning overload of [IModelTransformer.initFromExternalSourceAspects]($transformer) has been deprecated.
It will still perform the old behavior synchronously until it is removed. It will now however return a `Promise` (which should be
awaited) if invoked with the an [InitFromExternalSourceAspectsArgs]($transformer) argument, which is necessary when processing
changes instead of the full source contents.

## Presentation

### Restoring Presentation tree state

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

## Electron versions support

In addition to the already supported Electron 14, Electron versions 15, 16, and 17 are now supported (blog posts for Electron versions [15](https://www.electronjs.org/blog/electron-15-0), [16](https://www.electronjs.org/blog/electron-16-0), [17](https://www.electronjs.org/blog/electron-17-0)). At the moment, support for Electron 18 and 19 is blocked due to a bug in the V8 javascript engine (for more information see [Issue #35043](https://github.com/electron/electron/issues/35043)).
