# iTwin.js Extensions

An iTwin.js Extension is a separate JavaScript module that can load on demand into an iTwin.js frontend application. The separate deliverable enables Extensions to provide extensibility of an iTwin.js application at runtime.

Each Extension is its own separate bundle that has access to all iTwin.js [shared libraries](./extensions/SharedLibraries.md) to enable seamless integration with the host app.

Access to the iTwin.js shared libraries allows extensions to be used for many different purposes, such as:

- Add new UI to an existing application to better support your custom workflows
  - i.e. Tools, Widgets, Frontstages
- Write event based processing
  - i.e. Subscribe to an iModel Event, or Unified Selection Event, and process that change

## What's next

- [Getting Started](./extensions/GettingStarted.md)
- [Building an Extension](./extensions/BuildingAnExtension.md)
- [Supporting Extensions in iTwin.js App](./extensions/SetupAppForExtensions.md)
