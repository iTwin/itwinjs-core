# Write An Interactive Desktop App

## 1. Write the Portable Components
See [how to write an interactive app](./WriteAnInteractiveApp.md) for a guide to writing the portable and reusable [frontend](./Glossary.md#frontend) and [backend](./Glossary.md#backend) code.

## 2. Tailor the App
Any interactive app can be configured as a desktop app. A small additional effort is required to tailor it.

You must write an [Electron-specific main](../learning/AppTailoring.md) to do the following:
* [Configure the backend interfaces](./RpcInterface.md#configure-interfaces) for Electron.
* Integrate with Electron IPC
* Identify the main html page.

## 3. Package and Deploy
You must then package the app as an Electron app. This requires using the Electron build tools ... *TBD*