# Write An Interactive Web App

See [how to write an interactive app](./WriteAnInteractiveApp.md) for a guide to writing the portable and reusable frontend and backend code.

Any interactive app can be configured as a Web app. Some additional effort may be required to tailor it.

## Frontend
You must write a Web-specific main to do the following:
* [Configure interfaces](./RpcInterface.md#client-side-configuration) for Web. You must know the URL of the app's backend, if any, and of any other services used by the frontend.

You must package and deploy the app's frontend resources, including its html, css, and js files must to a static Web server.

## Backend
If the app has a custom backend, you must write a [web-specific main](../overview/AppTailoring.md) to do the following:
* [Configure the backend interfaces](./RpcInterface.md#3-configure-interfaces) for Web.
* Implement a simple Web server using a package such as express.
* [Serve the backend interfaces](./RpcInterface.md#4-serve-the-interfaces).

You must then deploy the app's custom backend as a service to the Web.