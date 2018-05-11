# iModelJs Apps

From the same JavaScript codebase, it is possible to create:

* [Backend Agents and Services](#agents-and-services) that process iModels and respond to events from iModelHub
* [Web Apps](#web-apps) that run in web browsers and communicate with backend code running in Web servers
* [Desktop Apps](#desktop-apps) that run on personal computers
* [Mobile Apps](#mobile-apps) that run on tablets and phones

## Agents and Services

iModel agents and services are apps that have no interactive user interface. They are generally deployed on servers, often in the cloud using containers (e.g. Docker) and managed using a cloud orchestration framework (e.g. Kubernetes.) Agents and services are always hosted by NodeJs.

Agents and services are [backend](../learning/Glossary.md#Backend) code. Their main concern is to access and process the content of iModels. They use [briefcases](../learning/Glossary.md#Briefcase) to access iModels.

Agents and services are written in TypeScript/JavaScript and depend on the `@bentley/imodeljs-backend` package. They may also depend on common packages such as imodeljs-common, bentlejs-core, or geometry-core. They frequently also use third-party JavaScript packages, as well as the services built into nodejs.

### iModel Agents

An *iModel Agent* is a program that performs an unattended action upon being invoked by an event from iModelHub.

As an example, consider an iModelJs Agent that receives notifications from iModelHub for every ChangeSet to a specific iModel. The Agent could inspect every changeset using the [ChangeSummaryManager]($backend) API to ensure all changes to its iModel are in compliance with company standards. A separate instance of the Agent would be deployed for each iModel of interest.

### iModel Services

An *iModel Service* is a program that responds to requests from other apps. A service runs on a server and waits for requests. A service may receive requests from [Web Apps](./WebApps) (frontend or backend) or from other services.

A true service is a stand-alone program that is never bundled with the clients that use it. An [app-specific backend](#app-backend) is a special kind of service that is logically part of an app and is often bundled with it. This distinction is important for [portability reasons](../learning/Portability.md#backend-portability).

An example of a service is a program that serves out spatial tiles that it extracts from a specified area of an iModel upon request.

An iModel service (or app backend) is exposed to clients using by a [gateway](#gateways). Client code must be written in TypeScript and must use the gateway to access an iModel service.

## Interactive Apps

An interactive app has two parts: a *frontend* containing its UI and a *backend* containing its data-access logic. Frontends and backends have very different concerns and must be kept strictly separate. They are sometimes bundled together in a single install set or program, and they are sometimes deployed separately to different machines or processes.

The backend implements services that are used by the frontend. Following good design principles, the frontend may call the backend, but not the other way around.

### App Backend

The data-access part of an app is called the [backend](https://en.wikipedia.org/wiki/Front_and_back_ends) of the app.

An app can use a pre-existing or general-purpose [service](#imodel-services) as its backend. For example, a family of viewing apps can use a general-purpose service that handles requests for data from a given iModel.

An app may require data-access services that are specific to and intrinsically part of the app. One reason is performance. An analysis that must make many related queries on iModel content, perhaps based on knowledge of a domain schema, in order to produce a single, combined result should be done close to the data. Another reason for app-specific backends is the [backends-for-frontends pattern](#backends-for-frontends). App-specific backends are easy to write using [gateways](#gateways) and are encouraged.

App-specific backends are written in TypeScript/JavaScript and depend on `@bentley/imodeljs-backend`. A backend may also depend on common packages such as imodeljs-common, bentlejs-core, or geometry-core. See [backend portability](../learning/Portability.md#backend-portability).

An app can use many services, both general-purpose and app-specific.

#### Backends for Frontends

Following the [backends-for-frontends pattern](https://samnewman.io/patterns/architectural/bff/), an app would ideally use different backend services for different configurations, rather than trying to rely on a one-size-fits-all backend service. The iModelJs gateway architecture encourages and supports the BFF pattern. Since a gateway is just a TypeScript class, it is easy for an app to implement its own services. And, it is easy for an app to choose a different mix of gateways at runtime, depending on its configuration.

### App Frontend

The UI-specific part of an app is called the [frontend](https://en.wikipedia.org/wiki/Front_and_back_ends). The frontend should be concerned only with display and user interaction.

The frontend must be written in TypeScript or JavaScript. The frontend should use Web technologies only, including HTML, CSS, and JavaScript. The frontend can use any Web app framework, such as React or Angular.

The frontend makes requests on backend services in order to access iModel content using gateways, as explained below. The frontend must use [gateways](#gateways) to communicate with the app's backend(s). The frontend should depend on `@bentley/imodeljs-frontend`. The frontend may also depend on common packages such as imodeljs-common, bentlejs-core, or geometry-core. It may also depend on Web-specific packages. The frontend must not depend on anything that requires native code or is dependent on nodejs.

### Gateways

A *gateway* is a set of operations exposed by a service that a client can call. To the iModelJs app programmer, a gateway is a TypeScript class, and using a gateway is a method call. Client and service must both be implemented in TypeScript/JavaScript. iModelJs services support only compliant script clients, and iModelJs clients use gateways exclusively when communicating with iModelJs services.

In operational terms, a gateway is composed of four things:
* A TypeScript interface that declares a set of requests that are provided by a service, including their parameters.
* A proxy class that allows the client to make requests.
* An implementation class that allows the service to handle the requests.
* A [configuration](#gateway-configurations) that marshalls the requests.

The static methods of the gateway interface are the operations offered by the service. The parameters and return type of the methods are the parameters and results of the operations. Note that the service is declared and exposed in TypeScript. There is no separate definition of the service. A client sends a request to a service by obtaining the proxy for the appropriate gateway and calling the appropriate method on it. A service exposes its API by defining and registering a class that is derived from the gateway interface. As far as both client and service are concerned, service operations are TypeScript method calls. The section on [gateway configurations](#gateway-configurations) below described how these calls are marshalled and dispatched.

A gateway is unidirectional. It allows a client to make a request on a service and get a return value. Services never send requests to clients.

Gateway methods must be "chunky" and not "chatty". In the case where a service or app backend is accessed over the Internet, both bandwidth and latency can vary widely. Therefore, care must be taken to limit number and size of round-trips between clients and services.

The key API class is [Gateway]($common).

### Gateway Configurations

A gateway defines a frontend-backend interface in a way that is independent of how the call will be made. The call is marshalled differently, depending on how the app itself is configured. iModelJs supplies transport mechanisms to marshall calls between client and service. These mechanisms are called *gateway configurations*. Configurations are applied to gateways at runtime. Available configurations include: cloud, desktop, and in-process.

#### Cloud gateway configuration

Transforms client calls on the gateway into HTTP requests. Provides endpoint-processing and call dispatching in the service process.

The iModelJs cloud gateway configuration is highly parameterized and can be adapted for use in many environments. This configuration is designed to cooperate with routing and authentication infrastructure.

See [BentleyCloudGatewayConfiguration]($common).

#### Desktop gateway configuration

Marshalls calls on the gateway through high-bandwidth, low-latency pipes between cooperating processes on the same computer. Provides endpoint-processing and call dispatching in the service backend process.

The iModelJs desktop gateway configuration is specific to Electron.

See [GatewayElectronConfiguration]($common).

#### In-process gateway configuration

Marshalls calls on the gateway across threads within a single process. Provides call dispatching in the backend thread.

### App Runtime Gateway Configuration

An app chooses the appropriate configuration for each gateway that it uses. For example, while an app accesses both true services and app-specific backends through gateways, the app must configure the gateways differently: a cloud configuration for services and a configuration based on its own app configuration for an app-specific backend.

## Interactive App Configurations

An iModelJs-based interactive app can be configured to run as a web app with a supporting web server, a desktop app, or a mobile app.

In all configurations, the frontend UI must be written using Web technologies, including HTML, CSS, and JavaScript, as it will be rendered in a Web view in all configurations. (In some configurations, the Web view will be embedded in an app.) That allows an app developer to write a UI that works equally well everywhere. The developer can also [swap in a different GUI](#making-apps-fit-the-platform) to suit each configuration, perhaps using the same frontend JavaScript.

The backend of the app can be the same in all configurations. An app developer can also employ the [backends for frontends](#backends-for-frontends) pattern to tailor the app to different configurations.  And, an app can use [platform-specific APIs](#making-apps-fit-the-platform).

### Web Apps

When configured as a Web app, the [frontend](#app-frontend) will run in a Web browser and the [backend](#app-backend) will run on a server. The frontend's assets (HTML pages and js files) will be served out by a server (generally different from the backend). The frontend and backend will use the [cloud configuration](#cloud-gateway-configuration) for all gateways. As noted, gateway requests will run through whatever router infrastructure surrounds each service.

### Desktop Apps

[Electron](https://electronjs.org/) is used to package an iModelJs app as a desktop app. In this case, the [frontend](#app-frontend) and [backend](#app-backend) will be in the same install set. There are still two processes, one for the backend and one for the frontend, but they physically reside on the same computer. The app will use the [desktop configuration](#desktop-gateway-configuration) for efficient local calls on app-specific gateways and [cloud configuration](#cloud-gateway-configuration) for remote services.

### Mobile Apps

When configured as a mobile app, the [frontend](#app-frontend) and [backend](#app-backend) will be bundled into a single app. The app will run as a single process, with frontend and backend in separate threads. The app will use the [in-process configuration](#in-process-gateway-configuration) for efficient in-process calls on app-specific gateways and [cloud configuration](#cloud-gateway-configuration) for remote services.

### Making Interactive Apps Fit the Platform

You may want to tailor the UI and function of an app for each configuration. For example, a mobile app will usually have a simpler UI than a desktop app, and a mobile app might offer mobile-specific features such as camera or GPS. Tailoring is relatively easy, because of the highly factored architecture of an iModelJs app. As a result, you can:

* Change the GUI
* Use the [backends for frontends pattern](#backends-for-frontends)
* Use platform-specific modules

Some of these adaptations involve swapping in different resources, such as HTML pages, at packaging time, while some merely require run-time checks. Run-time checks may be based on the `Platform.platformName` property.

### Change the GUI

An app's UI is contained within its frontend. And, the look and feel of the GUI is largely contained within its HTML and CSS resources. Swapping in a different GUI can be a simple as swapping in a different style sheet or HTML page, leaving the supporting JavaScript the same. You can develop and test the various version of the GUI in a single development environment. You can also write the frontend JavaScript to tailor the GUI at run time.

### Platform-specific Modules

An interactive app can use platform-specific modules that are supplied by the host platform in JavaScript. Mobile platforms such as iOS and Android, provide JavaScript classes for services that are specific to mobile apps. The Electron desktop platform provides all of the features of nodejs. Platform-specific modules must be used in [guarded code](../learning/Portability.md).
