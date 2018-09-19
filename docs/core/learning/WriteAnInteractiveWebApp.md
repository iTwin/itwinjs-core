# Write An Interactive Web App

#### 1. Write the Portable Components
See [how to write an interactive app](./WriteAnInteractiveApp.md) for a guide to writing the portable and reusable [frontend](./Glossary.md#frontend) and [backend](./Glossary.md#backend) code.

#### 2. Tailor the App
Any interactive app can be configured as a Web app. Some additional effort may be required to tailor it.

* Frontend


You must write a [Web-specific main](../learning/AppTailoring.md) to [configure interfaces](./RpcInterface.md#client-side-configuration) to access services over the Web. You must know the URL of all services used by the frontend, including its own backend.

* Backend


If the app has a custom backend, you must write a [Web-specific main](../learning/AppTailoring.md) to do the following:
* [Configure the backend interfaces](./RpcInterface.md#3-configure-interfaces) to serve clients over the Web.
* [Write a simple Web server](./RpcInterface.md#4-serve-the-interfaces) to serve the backend interfaces.

#### 3. Package and Deploy
[Package and deploy to the Web](./PackageAndDeployToTheWeb.md)