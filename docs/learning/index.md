# Getting started with iTwin.js

Welcome to the documentation site for the iTwin Platform's digital twin open-source JavaScript library, iTwin.js. iTwin.js offers a versatile and comprehensive set of APIs that can be utilized across various platforms, including web frontends and backends, web services, and desktop, in any context an [iModel](./imodels.md) is used. As a large library, your starting point will depend on the specific development project you have in mind. If you are interested in extending the user interface of an iTwin viewer by adding a new tool or widget, we recommend consulting [the frontend guide](./frontend/index). For higher-level React components, [AppUI](../ui/appui/index.md) may be of interest to you. If you're working on a service or on the server and want to query an iModel's data, you'll want to head over to our [backend documentation](./backend/index). While we're on the subject of querying data, we have a great [tutorial to get you up to speed on ECSQL](./ECSQLTutorial/index.md).

There's quite a bit to explore. The sections to the left and the [helpful articles at the bottom of this page](#helpful-articles) can help guide your iTwin.js application development.

In addition, iTwin.js is open source. We love suggestions and feedback on the library, but we love contributions to our codebase even more. If you think you have something to offer, submit a pull request and let's get it merged.

## iTwin.js software architecture

With the [iTwin.js Software architecture](./SoftwareArchitecture.md), from the same JavaScript codebase, it is possible to create:

- [Agents and Services](./SoftwareArchitecture.md#web) that process iModels and respond to events from iModelHub
- [Web Apps](./SoftwareArchitecture.md#web) that run in web browsers and communicate with backends
- [Desktop Apps](./SoftwareArchitecture.md#desktop) that run on personal computers
- [Mobile Apps](./SoftwareArchitecture.md#mobile) that run on tablets and phones

## Documentation Overview

This website is organized into sections by tabs at the top of each page.

- The [BIS](../bis/index.md) section explains the Base Infrastructure Schemas. Understanding BIS is essential to making sense of the iTwin.js APIs. Depending on your familiarity with database design, this is often the best starting point for understanding iModels and iTwin.js.
- The _Learning_ tab (this page) introduces the building blocks of iTwin.js and provides step-by-step instructions for creating applications.
- The [API Reference](../reference/index.md) tab explains the API in more detail with package/class/function level documentation.

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

## JavaScript version requirements

The iTwin.js library requires a JavaScript engine with es2017 support.

## Helpful articles

- [App frontend development](./frontend/index)
- [App backend development](./backend/index)
- [Classes packaged by both frontends and backends](./common/index)
- [API support policies](./api-support-policies.md)
- [ECSQL](./ECSQL.md)
- [Display system](./display/index.md)
- [iModelHub](./iModelHub/index)
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