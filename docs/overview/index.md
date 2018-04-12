# The iModelJs Library

The iModelJs library is a JavaScript api for creating, querying, displaying, and modifying iModels.

## Using iModelJs

The iModelJs library is a comprehensive set of services that can be used anywhere an iModel may be relevant.
It is designed to be modular and extensible, with the expectation that iModelJs will be used in environments with many
other JavaScript frameworks. iModelJs strives to be as consistent as possible with established JavaScript conventions,
though sometimes judgement calls are required where no established convention is clear.

From the same JavaScript codebase, it is possible to create:

* [Backend Agents](./Agents)  and services that process iModels and respond to events from iModelHub
* [Web Apps](./WebApps) that run in web browsers and communicate with Backends
* [Desktop Apps](./DesktopApps) that run on personal computers
* [Mobile Apps](./MobileApps) that run on tablets and phones

## Getting Started

Understanding the design and concepts in the iModelJs library requires a basic understanding of:

* [iModels](./iModels) - the persistence layer for iModelJs
* [IModelHub](./IModelHub) - the cloud-based hub for coordinating access to iModels
* [iModel Bridges](./IModelBridges) - the services that connect iModels with external data sources
* it is also helpful to understand the concepts in [BIS](./BisCore), the Base Infrastructure Schema
* The [Programmer Documentation](../learning/index) explains the API in more detail.


## JavaScript vs. TypeScript

iModelJs is written in [TypeScript](https://www.typescriptlang.org/). Even though it *can* be consumed in a pure JavaScript application, it is *highly recommended* that iModelJs application developers use TypeScript too. Throughout the iModelJs library, the arguments to functions are decorated with their expected types in TypeScript. The expectation is that the TypeScript compiler will verify the types of callers. Runtime checks to enforce correct types are not encouraged inside iModelJs, given they add overhead and are not necessary for TypeScript callers.

## JavaScript Version Requirements

The iModelJs library requires a JavaScript engine with es2017 support.

## iModelJs Organization

The iModelJs library is divided into these sub-packages:

|Package Name|Description
|--|--
|**@bentley/bentleyjs-core**|Utility classes and functions that can be run in either the frontend or the backend.
|**@bentley/geometry-core**|A library of classes and functions for operations on 2d and 3d geometry.
|**@bentley/imodeljs-backend** |The part of the iModelJs library that runs in Node.js The backend code communicates with the frontend via a Gateway. Often the backend code runs on a server, but it may also run on a desktop (see [Electron](https://electronjs.org)) or on a mobile device.
|**@bentley/imodeljs-frontend**|The part of the iModelJs library that runs in a web browser. The frontend utilizes the HTML document paradigm. It includes everything you need to query, display 2d and 3d views, and create [Tools](../learning/frontend/Tool) that modify iModels.
|**@bentley/imodeljs-native**|The part of the iModelJs library that performs low-level I/O to an iModel. @bentley/imodeljs-backend depends on this library.
