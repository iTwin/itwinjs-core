# The App Frontend

The frontend of an app refers to the layers of software that are concerned mainly with data display and user interaction, as described in the [app architecture overview](../../overview/SoftwareArchitecture.md).

The frontend *always* runs inside a web browser.

* When used with a backend service via HTTP, it can run in any modern web browser (see compatibility list.)
* When used with a desktop apps, it runs inside the Electron frontend process in Chrome.
* When used in a mobile app, it runs inside the Safari built-in browser on iOS and the Chrome browser for Android.

An app always implements its own frontend script and resources. The app's frontend script must depend on @bentley/imodeljs-frontend.

The iModelJs frontend library is delivered in the **npm package** `@bentley/imodeljs-frontend`

## Frontend operations supported by @bentley/imodeljs-frontend

* [Login and obtain AccessTokens](../common/AccessToken.md)
* [Open a "connection" to an iModel](./IModelConnection.md)
* [Adminstration](./IModelApp.md) via the IModelApp class
* [Localization](./Localization.md) of strings and user interface
* Writing [Tools](./Tools.md) for handling events from users
* Communicating with the Backend via an [RpcInterface](../RpcInterface.md)
* Displaying [Views](./Views.md) of iModels
* Executing [ECSQL queries](./ExecutingECSQL.md) on iModels

<!-- TODO - add browser compatibility list -->
