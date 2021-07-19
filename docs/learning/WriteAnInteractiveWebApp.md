# Write An Interactive Web App

[Simple Viewer App](https://github.com/imodeljs/imodeljs-samples/tree/master/interactive-app/simple-viewer-app) is a complete example of an interactive app that can be configured as a Web app.

## 1. Write the Portable Components

See [how to write an interactive app](./WriteAnInteractiveApp.md) for a guide to writing the portable and reusable [frontend](./Glossary.md#frontend) and [backend](./Glossary.md#backend) code.

## 2. Tailor the App

Any interactive app can be configured as a Web app. Some additional effort may be required to tailor it.

### Frontend

You must write a [Web-specific main](../learning/AppTailoring.md). That is where you will tailor the frontend, in order to give it the UI that suits the platform.

The Web-specific main must [configure RpcInterfaces](./RpcInterface.md#client-side-configuration) in order to access backends and services over the Web. There are several options, depending on how you design and deploy your app:

- *Frontend-only app* - This style of app uses only pre-existing backends and services. A `uriPrefix` is required for configuring each server.
- *Simple app* - This style of app has its own backend, and the backend serves the frontend. No uriPrefix is required when configuring the app's own backend server. A uriPrefix is required for any other, remote backend server that the app may use.
- Frontend and backend deployed separately - This style of app has its own backend, but the backend and frontend are deployed separately. A `uriPrefix` is required for configuring the app's own backend server and for any other server that it may use.

### Backend

If the app has a custom backend, you must write a [Web-specific main](../learning/AppTailoring.md) to do the following:

- [Configure the backend interfaces](./RpcInterface.md#configure-interfaces) to serve clients over the Web.
- [Write a simple Web server](./RpcInterface.md#serve-the-interfaces) to serve the backend interfaces.

## 3. Package and Deploy

[Package and deploy to the Web](./PackageAndDeployToTheWeb.md)
