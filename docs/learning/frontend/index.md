# The App Frontend

The frontend of an app is concerned mainly with data display and user interaction. Frontend code:

- Always runs in a web browser.
- Gets access to the data in an iModel by making requests on a [backend](../backend/index.md).

The following app configurations are supported:

- [Web app](../App.md#web-apps) - See [browser compatibility](#web-browser-compatibility)
- [Desktop app](../App.md#desktop-apps)
- [Mobile app](../App.md#mobile-apps)

See the [app architecture overview](../SoftwareArchitecture.md) for more on app structure.

An app's frontend always implements its own frontend script and resources.

An app's frontend will often depend on npm packages to help implement its GUI.

An app's frontend script requires the `@itwin/core-frontend` npm package.
The [common packages](../common/index.md) will also be required.

These packages provide the following functions that a frontend requires:

- [Login and obtain AccessTokens](../common/AccessToken.md)
- [Open a "connection" to an iModel](./IModelConnection.md)
- [Adminstration](./IModelApp.md) via the IModelApp class
- [Localization](./Localization.md) of strings and user interface
- Writing [Tools](./Tools.md) for handling events from users
- Communicating with the Backend via an [RpcInterface](../RpcInterface.md)
- Displaying [Views](./Views.md) of iModels
- Executing [ECSQL queries](./ExecutingECSQL.md) on iModels
- Storing [Settings](./Settings.md) for Applications, Projects, and iModels.
- [Formatting Quantities](./QuantityFormatting.md)

## Web browser compatibility

See [Supported Platforms Page](../SupportedPlatforms.md#Supported-Browsers)
