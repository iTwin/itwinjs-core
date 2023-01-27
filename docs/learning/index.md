# Introduction to iTwin.js

The iTwin.js library is a comprehensive set of APIs that can be used anywhere an [iModel](./imodels.md) may be relevant.
It is designed to be modular and extensible, with the expectation that iTwin.js will be used in environments with many
other JavaScript frameworks. iTwin.js strives to be as consistent as possible with established JavaScript conventions,
though sometimes judgement calls are required where no established convention is clear.

iTwin.js has been [architected](./SoftwareArchitecture.md) to make it straight-forward and easy to create a variety of different type of applications:

- [Web Apps](./SoftwareArchitecture.md#web) that run client side and communicate with backends
- [Desktop Apps](./SoftwareArchitecture.md#desktop) that run on personal computers
- [Mobile Apps](./SoftwareArchitecture.md#mobile) that run on tablets and phones
- [Services](./SoftwareArchitecture.md#web) that process and perform headless actions on iModels
- [Agents](./SoftwareArchitecture.md#web) that process and perform headless actions on iModels

## Helpful articles

- [App frontend development](./frontend/index)
- [App backend development](./backend/index)
- [Classes packaged by both frontends and backends](./common/index)
- [API support policies](./api-support-policies.md)
- [ECSQL](./ECSQL.md)
- [Display system](./display/index.md)
- [Snapshot iModels](./backend/AccessingIModels.md)
- [GeoLocation in iModels](./GeoLocation.md)
- [Change summaries](./ChangeSummaries.md)
- [Remote procedure call ("RPC") Interfaces](./RpcInterface)

Step by step instructions to:

- [Write a web service](./WriteAWebService.md)
- [Write a web agent](./WriteAWebAgent.md)
- [Write an interactive app](./WriteAnInteractiveApp.md)
  - [Web app](./WriteAnInteractiveWebApp.md)
  - [Desktop app](./WriteAnInteractiveDesktopApp.md)
  - [Mobile app](./WriteAnInteractiveMobileApp.md)
- [Write a connector](./WriteAConnector.md)

Tutorials:

- [ECSQL Tutorial](./ECSQLTutorial/index.md)
- [EC Schema Serialization](./serializing-xml-schemas.md)

See also:

- [Glossary of terms used in iTwin.js](./Glossary)
