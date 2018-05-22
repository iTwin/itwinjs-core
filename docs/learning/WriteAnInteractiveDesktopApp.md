# Write An Interactive Desktop App

See [how to write an interactive app](./WriteAnInteractiveApp.md) for a guide to writing the portable and reusable frontend and backend code.

Any interactive app can be configured as a desktop app. A small additional effort is required to tailor it.

You must write an [Electron-specific main](../overview/AppTailoring.md) to do the following:
* [Configure the backend interfaces](./RpcInterface.md#3-configure-interfaces) for Electron.
* Identify the main html page.

You must then package the app as an Electron app.