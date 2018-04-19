# Portability

The technology used by iModelJs makes it possible to write an app once and then deploy it to run on many platforms without modification.

iModelJs-based agents and services can run anywhere that nodejs is found, and that is just about everywhere.

An iModelJs-based interactive app that follows the iModelJs app architecture can be configured to run as a web app with a supporting web server, a desktop app, or a mobile app. That is, the same app can take all three forms without modifying the code or the user interface definition. You can also [tailor an app to fit each configuration](#making-apps-fit-the-platform) without rewriting or substantially changing it.

## Cross-Platform Technologies
The key technology that makes an app portable is JavaScript. JavaScript engines are available on many operating systems and Web browsers. TypeScript compiles to JavaScript.

[Nodejs](./Glossary.md#Node.js) is an execution environment for agents, services, and servers. Nodejs runs JavaScript programs. Nodejs itself runs on many platforms, including Windows and Linux. Nodejs is also widely supported by cloud infrastructures and deployment mechanisms.

Web UI technology, including HTML and CSS, makes it possible to write a cross-platform user interface that looks and behaves the same everywhere, in every configuration. Web UI technology is supported by Web browsers and Web view renderers on many platforms.

[Electron](./Glossary.md#Electron) combines a Web view client and a nodejs-based server into a single desktop product, without requiring any modification of the code or the UI. Electron runs on many desktop platforms.

## Cross-Platform Interactive App Architecture

To write a cross-platform interactive app, follow two basic guidelines:
1. Write the UI as if it were always going to be a Web page,
1. Follow the normal principles of good design to keep data access logic separate from UI logic.

The separation between UI and data access is a key architectural principle. The following sections explain the role of each part and how they relate to each other.

### UI Frontend
The UI-specific part of an app is called the [frontend](https://en.wikipedia.org/wiki/Front_and_back_ends). The frontend should be concerned only with display and user interaction.

The frontend must be written using Web technologies only, including HTML, CSS, and JavaScript. You can use whatever Web app framework you like. The frontend should use `@bentley/imodeljs-frontend` for accessing iModels.

When an app is configured as a Web app, the frontend takes the form of a set of HTML pages and supporting .js files, served out by a Web server and rendered in a Web browser.

When an app is configured as a Electron desktop app or as a Mobile app, the frontend's HTML and other assets are bundled as data resources of the overall app. In both desktop and mobile apps, the UI is rendered in a Chromium-based process in an Electron app and in an embedded Web viewer in a mobile app.

### Data Access Backend
The data-access part of an app is called the [backend](https://en.wikipedia.org/wiki/Front_and_back_ends). The backend must contain all code that accesses iModels. The backend can also contain the app's middle tier or business logic.

The backend of an app must be written entirely in TypeScript and/or JavaScript. The backend uses `@bentley/imodeljs-backend` for accessing iModels. imodeljs-backend also contains a portable classes for working with geometry and other kinds of data. The backend can also use other portable JavaScript packages.

When an app is configured as a Web app, the backend takes the form of a nodejs-based Web server that is deployed to the cloud.

When an app is configured as a Electron desktop app or as a mobile app, the backend's JavaScript and other assets are bundled as data resources of the overall app. The backend script is executed in a nodejs process by Electron and in an embedded JavaScript engine in a mobile app.

> The backend does not always run in nodejs and should not be node-specific. See [below](#avoiding-node-dependencies).

#### Backend main

To be precise, a few lines of the backend's main entry point must be different, depending on whether it is configured as a mobile app or not.

### Frontend -> Backend Gateways
The backend implements services that may be used by the frontend. Following good design principles, the frontend (UI) may call the backend (data access and business logic), but not the other way around.

Backend services are expressed as a normal TypeScript interface with static methods. So, when frontend code makes a request on the backend, it just calls a method on an object that implements the interface. Similarly, when the backend implements a set of services, it just implements normal TypeScript methods. Parameters and return values are normal TypeScript objects.

A class that represents a set of services offered by a backend is called a *gateway*. A gateway is in fact a pair of classes: a proxy that is used by the frontend and an implementation that is supplied by the backend. iModelJs supplies transport mechanisms to marshall calls between them.

When the app is configured as a Web app, transport is an HTTP request with associated request-handling in the backend Web server. In an Electron desktop app, transport is inter-process communication. And, in a mobile app, transport marshalls calls across threads. These are implementation details of the transport mechanism that do not affect frontend or backend code.

### Frontend, Backend, Gateways and Portability
With this lengthy introduction, it should be clear that the separation of an interactive app into frontend and backend portions and the use of gateways between them is the key to portability across configurations. The separation is both good design and allows the app to be configured either as a two-part client-server Web app or as a one-part desktop or mobile app. The gateway encapsulates and shields the app from the details of how frontend and backend communicate, allowing the app's logic to be the same in all configurations.

## Making Apps Fit the Platform

You will often want to tailor the UI and function of an app for each platform and configuration. For example, a mobile app will usually have a simpler UI than a desktop app, and a mobile app will offer mobile-specific features such as camera and geo-location. Tailoring is relatively easy, because of the highly factored architecture of an iModelJs app. As a result, you can:
* Change the GUI
* Use tailored gateways
* Use platform-specific modules

Some of these adaptations involve swapping in different resources, such as HTML pages, at packaging time, while some merely require run-time checks. Run-time checks may be based on the `Platform.platformName` property.

### Change the GUI
An app's UI is contained within its frontend. And, the look and feel of the GUI is contained within its HTML and CSS resources. Swapping in a different GUI can be a simple as swapping in a different style sheet or HTML page, leaving the supporting JavaScript the same. You can develop and test the various version of the GUI in a single development environment. You can also write the code-behind to tailor the GUI at run time.

### Tailored Gateways
Following the [backends-for-frontends pattern](https://samnewman.io/patterns/architectural/bff/), an app would ideally use different backend services for different configurations, rather than trying to rely on a one-size-fits-all backend service. The iModelJs gateway architecture encourages and supports the BFF pattern. Since a gateway is just a TypeScript class, it's easy for an app to implement a set of services. And, it's easy for an app to choose a different mix of gateways at runtime, depending on its configuration.

### Platform-specific Modules
A portable interactive app can use platform-specific modules that are supplied by the host platform in JavaScript. Mobile platforms such as iOS and Android, provide JavaScript classes for services that are specific to mobile apps. The Electron desktop platform provides all of the features of nodejs.

## Avoiding node dependencies
The backend of an interactive app should not assume that it is running in nodejs.
> The backend must not depend on ny node-specific package, including any package that is based on native code. (fs-extra -> see IModelJsFs)

A backend can use node builtins in guarded code.

A backend can use the following portable imodeljs-backend classes to avoid unnecessary node dependencies:

|Node builtin|imodeljs-backend portable substitute|
|---|---|---|
|fs|IModelJsFs
|os|Platform
|process|Platform
|__dirname|KnownLocations
|__filename|KnownLocations
|console|Logger
|path|path|

In most cases, the imodeljs-backend substitutes do *not* provide all of the properties of the node global. That is by design, as not all of the features offered by node are portable.

A partial implementation of `path` is provided on non-nodejs platforms.

All other node modules and globals are *not* portable and must not be used in un-guarded code.