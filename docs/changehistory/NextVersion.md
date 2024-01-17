---
publish: false
---

# NextVersion

## OpenTelemetry Tracing

As the OpenTelemetry API kept growing, we decided to deprecate the [Tracing]($bentley) class and encourage direct usage of `@opentelemetry/api` instead.

iTwin.js will continue to create spans for RPC requests, and possibly other operations in the future.
