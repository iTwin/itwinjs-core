# The @bentley/imodeljs-frontend package

The **imodeljs-frontend** package always runs inside a web browser:

* When used with a backend service via HTTP, it can run in any modern web browser (see compatibility list.)
* When used with a desktop apps, it runs inside the Electron frontend process in Chrome.
* When used in a mobile app, it runs inside the Safari built-in browser on iOS and the Chrome browser for Android.

## Frontend Services

* [Adminstration](./IModelApp) via the IModelApp class
* [Localization](./Localization) of strings and user interface
* Writing [Tools](./Tools) for handling events from users
* Communicating with the Backend via a [Gateway](./Gateway)
* Displaying [Views](./Views) of iModels
* Executing [ECSQL queries](./ExecutingECSQL) on iModels

<!-- TODO - add browser compatibility list -->
