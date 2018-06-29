
<p style="text-align: center;">
![](./imodeljs.ico)
</p>
<p style="text-align: center;">
<b>iModelJs</b> is a JavaScript API for creating, querying, displaying, and modifying iModels.
</p>

## Documentation Overview

This website is organized into sections by tabs at the top of each page.

* You are currently looking at the Overview page. Start here.
* Please read the [Getting Started](../getting-started/index.md) page to install prerequisites for developers and for suggestions for background reading.
* The [BIS](../bis/index.md) tab explains the Base Infrastructure Schemas. Understanding BIS is essential to making sense of the iModelJs apis. Depending on your familiarity with database design, this is often the best starting point for understanding iModels and iModelJs.
* The [Learning](../learning/index) tab introduces the building blocks of iModelJs and provides step-by-step instructions for creating applications.
* The [API Reference](../reference/index) tab explains the API in more detail with package/class/function level documentation.

## Using iModelJs

The iModelJs library has a comprehensive set of APIs that can be used anywhere an iModel may be relevant.
It is designed to be modular and extensible, with the expectation that iModelJs will be used in environments with many
other JavaScript frameworks. iModelJs strives to be as consistent as possible with established JavaScript conventions,
though sometimes judgement calls are required where no established convention is clear.

From the same JavaScript codebase, it is possible to create:

* [Agents and Services](./SoftwareArchitecture.md#web) that process iModels and respond to events from iModelHub
* [Web Apps](./SoftwareArchitecture.md#web) that run in web browsers and communicate with backends
* [Desktop Apps](./SoftwareArchitecture.md#desktop) that run on personal computers
* [Mobile Apps](./SoftwareArchitecture.md#mobile) that run on tablets and phones

## iModelJs vs. iModelHub

It is important to understand that iModelJs applications do not *run on iModelHub*. Instead, they can run *anywhere else*. iModelJs applications always work on a copy of an iModel in a *briefcase*, obtained from iModelHub, and process it locally, making them *infinitely scalable*.

iModelJs applications can be:

* hosted on any cloud service
* deployed using any [cloud deployment model](https://en.wikipedia.org/wiki/Cloud_computing#Deployment_models)
* packaged with any container tool (e.g. [Docker](https://www.docker.com/))
* managed with any orchestration system (e.g. [Kubernetes](https://kubernetes.io/))
* installed on desktops and mobile devices

## JavaScript vs. TypeScript

iModelJs is written in [TypeScript](https://www.typescriptlang.org/). Even though it *can* be consumed in a JavaScript application, it is *highly recommended* that iModelJs application developers use TypeScript too when possible. Throughout the iModelJs library, the arguments and return values of functions are decorated with their expected types in TypeScript. The TypeScript compiler will verify the types of callers. Runtime checks to enforce correct types are not encouraged inside iModelJs, given they add overhead and are not necessary for TypeScript callers. Therefore, pure JavaScript consumers of iModelJs must be careful to not pass incorrect types.

## JavaScript Version Requirements

The iModelJs library requires a JavaScript engine with es2017 support.

## iModelJs Organization

The iModelJs library is divided into these npm packages in the `@bentley` scope:

|Package Name|Description
|---|---
|**bentleyjs-core**|General classes and utilities that are not specific to iModelJs.
|**geometry-core**|Operations on 2d and 3d geometry.
|**imodeljs-backend**|Usually runs on a server or desktop via Node.js, but also runs mobile devices. The backend code exposes operations to the frontend via an RpcInterface.
|**imodeljs-frontend**|Runs in a web browser. The frontend utilizes the HTML document paradigm. It includes everything you need to query, display 2d and 3d views, and create [Tools](../learning/frontend/Tool) that modify iModels.
|**imodeljs-common**|Classes that are shared between the frontend and backend.
|**imodeljs-native**|Performs low-level I/O to an iModel. Runs only on backends, and `imodeljs-backend` depends on this package.
