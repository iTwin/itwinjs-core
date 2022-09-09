# Diagnostics API

The presentation manager provides a way to gather diagnostics (performance metrics, logs, etc.) on a per-request basis. The APIs that should be used to get the diagnostics depend on the requirements and whether diagnostics are needed on the backend or the frontend.

In all cases getting diagnostics consists of two pieces:

- Options - what kind of diagnostics are requested.
- Handler - a function that accepts the diagnostics after the request is fulfilled.

## Getting request diagnostics on the frontend

On the frontend side diagnostics can be requested on a per request basis, by supplying diagnostics options through `diagnostics` attribute to [PresentationManager]($presentation-frontend) requests. Resulting diagnostics are then passed to the given handler.

```ts
[[include:Presentation.Diagnostics.Frontend]]
```

## Getting request diagnostics on the backend

There are two ways to retrieve diagnostics on the backend - through request parameters or through [PresentationManager]($presentation-backend).

### Getting diagnostics on a per-request basis

To get diagnostics on a per request basis, diagnostics options can be supplied through `diagnostics` attribute to [PresentationManager]($presentation-backend) requests. Resulting diagnostics are then passed to the given handler.

```ts
[[include:Presentation.Diagnostics.Backend.PerRequest]]
```

### Getting diagnostics for all requests

It's also possible to set up [PresentationManager]($presentation-backend) to retrieve diagnostics of every request made through it. This can be done by supplying diagnostics options, including the handler, when calling [PresentationManager.initialize]($presentation-backend).

```ts
[[include:Presentation.Diagnostics.Backend.PerManager]]
```

This approach also allows the backend to use request diagnostics for telemetry and logging, e.g. in combination with OpenTelemetry. See the [Diagnostics and OpenTelemetry](#diagnostics-and-opentelemetry) section for more details.

## Diagnostics and OpenTelemetry

[OpenTelemetry](https://opentelemetry.io/) is a vendor-neutral standard to collect telemetry data - metrics, logs and traces. The `@itwin/presentation-opentelemetry` package provides APIs to easily convert presentation diagnostics objects to OpenTelemetry objects, which makes collecting Presentation-related telemetry much easier.

```ts
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { context, trace } from "@opentelemetry/api";
import { convertToReadableSpans } from "@itwin/presentation-opentelemetry";
import { Presentation } from "@itwin/presentation-backend";

const traceExporter = new OTLPTraceExporter({
  url: "<OpenTelemetry collector's url>",
});

Presentation.initialize({
  diagnostics: {
    // requesting performance metrics
    perf: true,
    // the handler function is called after every request made through the `Presentation` API
    handler: (diagnostics) => {
      // get the parent span that our diagnostics should nest under
      const parentSpanContext = trace.getSpan(context.active())?.spanContext();
      // convert diagnostics to OpenTelemetry spans
      const spans = convertToReadableSpans(diagnostics, parentSpanContext);
      // do export
      traceExporter.export(spans, () => {});
    }
  },
});
```
