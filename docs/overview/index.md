# The iModelJs Library

The iModelJs library is a JavaScript api for creating, querying, displaying, and modifying iModels.

## Using iModelJs

The iModelJs library is a comprehensive set of services that can be used anywhere an iModel may be relevant.
It is designed to be modular and extensible, with the expectation that iModelJs will be used in environments with many
other JavaScript frameworks. iModelJs strives to be as consistent as possible with established JavaScript conventions,
though sometimes judgement calls are required where no established convention is clear.

From the same JavaScript codebase, it is possible to create:

* [Backend Agents and Services](Agents) that process iModels and respond to events from iModelHub
* [Web Apps](WebApps) that run in web browsers and communicate with Backends
* [Desktop Apps](DesktopApps) that run on personal computers
* [Mobile Apps](MobileApps) that run on tablets and phones

## iModelJs vs. iModelHub

It is important to understand that iModelJs applications do not *run on iModelHub*. Instead, they can run *anywhere else*. iModelJs applications always work on a *copy* of an iModel and process it locally, making them *infinitely scalable*.

iModelJs applications can be:

* hosted on any cloud service
* deployed using any [cloud deployment model](https://en.wikipedia.org/wiki/Cloud_computing#Deployment_models)
* packaged with any container tool (e.g. [Docker](https://www.docker.com/))
* managed with any orchestration system (e.g. [Kubernetes](https://kubernetes.io/))
* installed on desktops and mobile devices

## Getting Started

Understanding the design and concepts in the iModelJs library requires a basic understanding of:

* [iModels](iModels) - the persistence layer for iModelJs
* [IModelHub](IModelHub) - the cloud-based hub for coordinating access to iModels
* [iModel Bridges](IModelBridges) - the services that connect iModels with external data sources
* it is also helpful to understand the concepts in [BIS](BisCore), the Base Infrastructure Schema
* The [Programmer Documentation](../learning/index) explains the API in more detail.

## JavaScript vs. TypeScript

iModelJs is written in [TypeScript](https://www.typescriptlang.org/). Even though it *can* be consumed in a JavaScript application, it is *highly recommended* that iModelJs application developers use TypeScript too when possible. Throughout the iModelJs library, the arguments to functions are decorated with their expected types in TypeScript. The expectation is that the TypeScript compiler will verify the types of callers. Runtime checks to enforce correct types are not encouraged inside iModelJs, given they add overhead and are not necessary for TypeScript callers.

## JavaScript Version Requirements

The iModelJs library requires a JavaScript engine with es2017 support.

## iModelJs Organization

The iModelJs library is divided into these sub-packages:

|Package Name|Description
|--|--
|**@bentley/bentleyjs-core**|General utilities that can be run in either the frontend or the backend.
|**@bentley/geometry-core**|Operations on 2d and 3d geometry.
|**@bentley/imodeljs-backend** |Usually runs on a server or desktop via Node.js, but also runs mobile devices. The backend code communicates with the frontend via a Gateway. .
|**@bentley/imodeljs-frontend**|Runs in a web browser. The frontend utilizes the HTML document paradigm. It includes everything you need to query, display 2d and 3d views, and create [Tools](../learning/frontend/Tool) that modify iModels.
|**@bentley/imodeljs-common** |Common between the frontend and backend.
|**@bentley/imodeljs-native**|Performs low-level I/O to an iModel. @bentley/imodeljs-backend depends on this package.
