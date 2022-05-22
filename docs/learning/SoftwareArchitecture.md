# Software Architecture for iTwin.js platform

The software architecture of iTwin.js was driven by the following goals:

- Support iModel-based services running in any cloud or on-premise
- Support iModel-based web/desktop/mobile apps
- Re-use business logic across cloud, web, desktop, and mobile apps
- Re-use HTML GUI across web, desktop, and mobile apps

[Backend](../learning/backend/index) Architecture Layers:

- Application Backend (TypeScript)
- iTwin.js Backend Framework (TypeScript)
- JavaScript Runtime with C++ Interoperability
- iTwin.js Native Libraries (C++)

[Frontend](../learning/frontend/index) Architecture Layers:

- Application Frontend (TypeScript/JavaScript)
- iTwin.js Frontend Framework (TypeScript)
- HTML GUI
- Web Browser

## Web

iTwin.js Web App backends are [Node.js](http://www.nodejs.org) applications.
Node.js provides the [V8 JavaScript Engine](https://developers.google.com/v8/) and the [N-API](https://github.com/nodejs/abi-stable-node) for writing Node Addons in C++.
This is how the iTwin.js Native Libraries are exposed to the iTwin.js backend framework.
Portable application logic is written in TypeScript and calls TypeScript APIs exposed from the `@itwin/core-backend` package.

Notice that the backend architecture is identical between Agents and backends for interactive Web Applications.

Web App frontends run in a web browser and use HTML GUI for presentation, and APIs exposed from the `@itwin/core-frontend` package for *Remote Procedure Calls* (RPC) to request services from the backend.

The [frontend --> backend communication](./RpcInterface.md) is over HTTPS for interactive web applications.

![SoftwareArchitecture-Web](./SoftwareArchitecture-Web.png)

![>](./next.png) [Write an interactive Web app](../learning/WriteAnInteractiveWebApp.md)

![>](./next.png) [Write a Web service](../learning/WriteAWebService.md)

![>](./next.png) [Write a Web agent](../learning/WriteAWebAgent.md)

Also see [Logging and ActivityIds](./RpcInterface.md#logging-and-activityids)

## Desktop

iTwin.js desktop applications use the [Electron](https://electronjs.org/) Framework.
The backend architecture is the same as with iTwin.js Web Apps because Electron also uses Node.js.
The primary difference in the frontend architecture is that an embedded [Chromium Browser](https://www.chromium.org/Home) replaces a standalone Web Browser.

The [frontend --> backend communication](./RpcInterface.md) is over *Inter Process Communication* (IPC) as provided by Electron. Note that iTwin.js desktop applications always have at least
two (one frontend and at least one backend) processes active together.

![SoftwareArchitecture-Desktop](./SoftwareArchitecture-Desktop.png)

![>](./next.png) [Write a desktop app](../learning/WriteAnInteractiveDesktopApp.md)

## Mobile

iTwin.js mobile applications use the JavaScript Engine and Web Browser GUI controls built into the Android SDK and iOS SDK.

The [frontend --> backend communication](./RpcInterface.md) is over function calls and messages between two separate JavaScript contexts.

![SoftwareArchitecture-Mobile](./SoftwareArchitecture-Mobile.png)

![>](./next.png) [Write a mobile app](../learning/WriteAnInteractiveMobileApp.md)

## Comparison

The following diagram compares the architecture of web, desktop, and mobile applications and shows how the goals of portability and reuse are accomplished.

![SoftwareArchitecture-Comparison](./SoftwareArchitecture-Comparison.png)
