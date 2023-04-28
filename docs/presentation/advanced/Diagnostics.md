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

It's also possible to set up [PresentationManager]($presentation-backend) to retrieve diagnostics of every request made through it. This can be done by supplying diagnostics options, including the handler, when calling [Presentation.initialize]($presentation-backend).

```ts
[[include:Presentation.Diagnostics.Backend.PerManager]]
```

This approach also allows the backend to use request diagnostics for telemetry and logging, e.g. in combination with OpenTelemetry. See the [Diagnostics and OpenTelemetry](#diagnostics-and-opentelemetry) section for more details.

## Diagnostics and OpenTelemetry

[OpenTelemetry](https://opentelemetry.io/) is a vendor-neutral standard to collect telemetry data - metrics, logs and traces. The `@itwin/presentation-opentelemetry` package provides APIs to easily export presentation diagnostics as OpenTelemetry data, which makes collecting Presentation-related telemetry much easier.

The first part is to set up OpenTelemetry tracing, which could look like this:

```ts
import { Resource } from "@opentelemetry/resources";
import * as opentelemetry from "@opentelemetry/sdk-node";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

// configure the OpenTelemetry data exporting to the console
const telemetry = new opentelemetry.NodeSDK({
  traceExporter: new ConsoleSpanExporter(),
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "presentation-test-app",
  }),
});
telemetry.start();
process.on("SIGTERM", () => {
  telemetry.shutdown().finally(() => process.exit(0));
});
```

See [OpenTelemetry](https://github.com/open-telemetry/opentelemetry-js#set-up-tracing) for more details on this part.

The second part is to set up presentation diagnostics data exporting as OpenTelemetry traces:

```ts
import { exportDiagnostics } from "@itwin/presentation-opentelemetry";
import { context } from "@opentelemetry/api";

const presentationBackendProps: PresentationProps = {};
presentationBackendProps.diagnostics = {
  // requesting performance metrics
  perf: {
    // only capture spans that take more than 50 ms
    minimumDuration: 50,
  },
  // a function to capture current context - it's passed to the `handler` function as the second argument
  requestContextSupplier: () => context.active(),
  // the handler function is called after every request made through the `Presentation` APIs
  handler: (diagnostics, ctx) => {
    // call `exportDiagnostics` from the `@itwin/presentation-opentelemetry` package to parse diagnostics
    // data and export it through OpenTelemetry
    exportDiagnostics(diagnostics, ctx);
  },
};
Presentation.initialize(presentationBackendProps);
```
