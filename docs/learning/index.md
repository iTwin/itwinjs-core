# Documentation Overview

This website is organized into sections by tabs at the top of each page.

- Please read the [Getting Started](../getting-started/index.md) page to install prerequisites for developers and for suggestions for background reading.
- The [BIS](../bis/index.md) section explains the Base Infrastructure Schemas. Understanding BIS is essential to making sense of the iTwin.js APIs. Depending on your familiarity with database design, this is often the best starting point for understanding iModels and iTwin.js.
- The _Learning_ tab (this page) introduces the building blocks of iTwin.js and provides step-by-step instructions for creating applications.
- The [API Reference](../reference/index) tab explains the API in more detail with package/class/function level documentation.

## Using iTwin.js

The iTwin.js library has a comprehensive set of APIs that can be used anywhere an [iModel](./imodels.md) may be relevant.
It is designed to be modular and extensible, with the expectation that iTwin.js will be used in environments with many
other JavaScript frameworks. iTwin.js strives to be as consistent as possible with established JavaScript conventions,
though sometimes judgement calls are required where no established convention is clear.

With the [iTwin.js Software architecture](./SoftwareArchitecture.md), from the same JavaScript codebase, it is possible to create:

- [Agents and Services](./SoftwareArchitecture.md#web) that process iModels and respond to events from iModelHub
- [Web Apps](./SoftwareArchitecture.md#web) that run in web browsers and communicate with backends
- [Desktop Apps](./SoftwareArchitecture.md#desktop) that run on personal computers
- [Mobile Apps](./SoftwareArchitecture.md#mobile) that run on tablets and phones

## iTwin.js vs. iModelHub

It is important to understand that iTwin.js applications do not _run on [iModelHub](./iModelHub/index)_. Instead, they can run _anywhere else_. iTwin.js applications always work on a copy of an iModel, either a _briefcase_ or _checkpoint_ obtained from iModelHub, or a [snapshot iModel](./backend/AccessingIModels.md) created by an iTwin.js application, and process it locally. This makes them _infinitely scalable_.

iTwin.js applications can be:

- hosted on any cloud service
- deployed using any [cloud deployment model](https://en.wikipedia.org/wiki/Cloud_computing#Deployment_models)
- packaged with any container tool (e.g. [Docker](https://www.docker.com/))
- managed with any orchestration system (e.g. [Kubernetes](https://kubernetes.io/))
- installed on desktops and mobile devices

## JavaScript vs. TypeScript

iTwin.js is written in [TypeScript](https://www.typescriptlang.org/). Even though it _can_ be consumed in a JavaScript application, it is _highly recommended_ that iTwin.js application developers use TypeScript too when possible. Throughout the iTwin.js library, the arguments and return values of functions are decorated with their expected types in TypeScript. The TypeScript compiler will verify the types of callers. Runtime checks to enforce correct types are not encouraged inside iTwin.js, given they add overhead and are not necessary for TypeScript callers. Therefore, pure JavaScript consumers of iTwin.js must be careful to not pass incorrect types.

## JavaScript Version Requirements

The iTwin.js library requires a JavaScript engine with es2017 support.

## Helpful articles

- [Snapshot iModels](./backend/AccessingIModels.md)
- [App frontend development](./frontend/index)
- [App backend development](./backend/index)
- [Classes packaged by both frontends and backends](./common/index)
- [iModelHub](./iModelHub/index)
- [GeoLocation in iModels](./GeoLocation.md)
- [ECSQL](./ECSQL.md)
- [Change Summaries](./ChangeSummaries.md)
- [Remote Procedure Call (RPC) Interfaces](./RpcInterface)

Step by step instructions to:

- [Write a Web service](./WriteAWebService.md)
- [Write a Web agent](./WriteAWebAgent.md)
- [Write an interactive app](./WriteAnInteractiveApp.md)
  - [Web app](./WriteAnInteractiveWebApp.md)
  - [Desktop app](./WriteAnInteractiveDesktopApp.md)
  - [Mobile app](./WriteAnInteractiveMobileApp.md)
- [Write a Connector](./WriteAConnector.md)

Tutorials:

- [ECSQL Tutorial](./ECSQLTutorial/index.md)

See also:

- [Glossary of terms used in iTwin.js](./Glossary)
- [Frequently asked Questions](./faq)
