# iModelJs Apps

From the same JavaScript codebase, it is possible to create:

* [Backend Agents and Services](#agents-and-services) that process iModels and respond to events from iModelHub
* [Interactive Apps](#interactive-apps) that have a GUI and access iModel content. Several kinds of apps are supported:
  * [Web Apps](#web-apps) that run in web browsers and communicate with backend code running in Web servers
  * [Desktop Apps](#desktop-apps) that run on personal computers
  * [Mobile Apps](#mobile-apps) that run on tablets and phones
* [Bridges](../learning/WriteABridge.md)

## Agents and Services

iModel agents and services are apps that have no interactive user interface. They are generally deployed on servers, often in the cloud using containers (e.g. Docker) and managed using a cloud orchestration framework (e.g. Kubernetes.) Agents and services are always hosted by NodeJs.

Agents and services are [backend](../learning/Glossary.md#Backend) code. Their main concern is to access and process the content of iModels. They use [briefcases](../learning/Glossary.md#Briefcase) to access iModels.

Agents and services are written in TypeScript/JavaScript and depend on the `@bentley/imodeljs-backend` package. They may also depend on common packages such as imodeljs-common, bentleyjs-core, or geometry-core. They frequently also use third-party JavaScript packages, as well as the services built into nodejs.

Agents and Services use [logging](../learning/common/Logging.md) to enable users to monitor their operations and to help with diagnosing problems.

See the [diagram of a Web agent](./SoftwareArchitecture.md#web) for an overview of the software components found in agents and services.

### iModel Agents

An *iModel Agent* is a program that performs an unattended action upon being invoked by an event from iModelHub.

As an example, consider an iModelJs Agent that receives notifications from iModelHub for every ChangeSet to a specific iModel. The Agent could inspect every changeset using the [ChangeSummaryManager]($backend) API to ensure all changes to its iModel are in compliance with company standards. A separate instance of the Agent would be deployed for each iModel of interest.

![>](./next.png) [How to write a Web agent](../learning/WriteAWebAgent.md).

### iModel Services

An *iModel Service* is a program that responds to requests from other apps. A service runs on a server and waits for requests. A service may receive requests from [Web Apps](#web-apps) (frontend or backend) or from other services.

A true service is a stand-alone program that is never bundled with the clients that use it. An [app-specific backend](#app-backend) is a special kind of service that is logically part of an app and is often bundled with it. This distinction is important for [portability reasons](../learning/Portability.md#backend-portability).

An example of a service is a program that serves out spatial tiles that it extracts from a specified area of an iModel upon request.

An iModel service or app backend exposes an *interface* that clients can use to make requests. An iModel service interface is an [RpcInterface](./RpcInterface.md). A service always configures its interfaces using a [Web RPC configuration](./RpcInterface.md#web-rpc-configuration). Client code must be written in TypeScript and must use an RpcInterface to access the operations in an iModel service.

![>](./next.png) [How to write a Web service](../learning/WriteAWebService.md).

## Interactive Apps

An interactive app obtains information from an iModel and presents that information in a user interface. It has a [frontend](#app-frontend) and a [backend](#app-backend), which communication through [RpcInterfaces](./RpcInterface.md). An iModelJs-based interactive app can be configured to run as a Web app, a desktop app, or a mobile app.

![>](./next.png) [How to write an interactive app](../learning/WriteAnInteractiveApp.md).

### Configurations

#### Web Apps

When configured as a Web app, the [frontend](#app-frontend) will run in a Web browser and the [backend](#app-backend) will run on a server. The frontend's assets (HTML pages and js files) will be served out by a server (generally different from the backend). The frontend and backend will use a [Web configuration](./RpcInterface.md#web-rpc-configuration) for all RpcInterfaces. See the [diagram of a Web app](./SoftwareArchitecture.md#web) for an overview. Also see [app tailoring](./AppTailoring.md).

![>](./next.png) [How to write an interactive Web app](../learning/WriteAnInteractiveWebApp.md).

#### Desktop Apps

[Electron](https://electronjs.org/) is used to package an iModelJs app as a desktop app. In this case, the [frontend](#app-frontend) and [backend](#app-backend) will be in the same install set. There are still two processes, one for the backend and one for the frontend, but they physically reside on the same computer. The app will use the [desktop configuration](./RpcInterface.md#desktop-rpc-configuration) for efficient local calls on app-specific RpcInterfaces and a [Web configuration](./RpcInterface.md#web-rpc-configuration) for remote services. See the [diagram of a desktop app](./SoftwareArchitecture.md#desktop) for an overview. Also see [app tailoring](./AppTailoring.md).

![>](./next.png) [How to write an interactive desktop app](../learning/WriteAnInteractiveDesktopApp.md).

#### Mobile Apps

When configured as a mobile app, the [frontend](#app-frontend) and [backend](#app-backend) will be bundled into a single app. The app will run as a single process, with frontend and backend in separate threads. The app will use the [in-process configuration](./RpcInterface.md#in-process-rpc-configuration) for efficient in-process calls on app-specific RpcInterfaces and a [Web configuration](./RpcInterface.md#web-rpc-configuration) for remote services. See the [diagram of a mobile app](./SoftwareArchitecture.md#mobile) for an overview. Also see [app tailoring](./AppTailoring.md).

![>](./next.png) [How to write an interactive mobile app](../learning/WriteAnInteractiveMobileApp.md).

### Architecture

The two concerns of an interactive app are cleanly separated in the [iModelJs app architecture](./SoftwareArchitecture.md) into frontend and backend.

#### App Backend

The data-access part of an app is called the [backend](https://en.wikipedia.org/wiki/Front_and_back_ends).

An app can use a pre-existing or general-purpose [service](#imodel-services) as its backend. For example, a family of viewing apps can use a general-purpose service that handles requests for data from a given iModel.

An app may require data-access operations that are specific to and intrinsically part of the app. One reason is performance. An analysis that must make many related queries on iModel content, perhaps based on knowledge of a domain schema, in order to produce a single, combined result should be done close to the data. Another reason for app-specific backends is the [backends-for-frontends pattern](./AppTailoring.md#backends-for-frontends). App-specific backends are easy to write using [RpcInterfaces](./RpcInterface.md) and are encouraged.

App-specific backends are written in TypeScript/JavaScript and depend on `@bentley/imodeljs-backend`. A backend may also depend on common packages such as imodeljs-common, bentleyjs-core, or geometry-core. See [backend portability](../learning/Portability.md#backend-portability).

An app can use many services, both general-purpose and app-specific.

App backends may use [logging](../learning/common/Logging.md) to help with diagnosing problems.

#### App Frontend

The UI-specific part of an app is called the [frontend](https://en.wikipedia.org/wiki/Front_and_back_ends). The frontend should be concerned only with display and user interaction.

The frontend must be written in TypeScript or JavaScript. The frontend should use Web technologies only, including HTML, CSS, and JavaScript. The frontend can use any Web app framework, such as React or Angular.

The frontend makes requests on backend services in order to access iModel content. The frontend uses [RpcInterfaces](./RpcInterface.md) to communicate with the app's backend(s) and other services. The frontend should depend on `@bentley/imodeljs-frontend`. The frontend may also depend on common packages such as imodeljs-common, bentleyjs-core, or geometry-core. It may also depend on Web-specific packages. Both the UI and functionality of the app frontend [can be tailored](./AppTailoring.md) to best fit each desired configuration and target platform.
