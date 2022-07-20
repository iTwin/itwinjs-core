# The App Frontend

The frontend of an app is concerned mainly with data visualization and user interaction. Frontend code:

- Always runs in a web browser.
- Gets access to the data in an iModel by making requests on a [backend](../backend/index.md).
- May use the [display system](../display/index.md) to visualize the contents of an iTwin.

The following app configurations are supported:

- [Web app](../App.md#web-apps) - See [browser compatibility](#web-browser-compatibility)
- [Desktop app](../App.md#desktop-apps)
- [Mobile app](../App.md#mobile-apps)

See the [app architecture overview](../SoftwareArchitecture.md) for more on app structure.

An app's frontend always implements its own frontend script and resources.

An app's frontend will often depend on npm packages to help implement its GUI.

An app's frontend script requires the `@itwin/core-frontend` npm package.
The [common packages](../common/index.md) will also be required.

These packages provide the following services:

- [Log in and obtain AccessTokens](../common/AccessToken.md)
- [Open a "connection" to an iModel](./IModelConnection.md)
- [Adminstration and configuration](./IModelApp.md) via the IModelApp class
- [Localization](./Localization.md) of strings and user interface
- Writing [Tools](./Tools.md) for handling events from users
- Communicating with the Backend via an [RpcInterface](../RpcInterface.md)
- Displaying [Views](./Views.md) of iModels
- Executing [ECSQL queries](./ExecutingECSQL.md) on iModels
- Storing [User Preferences](./Preferences.md) for iTwins and iModels
- [Formatting Quantities](./QuantityFormatting.md)
- Writing [Extensions](./Extensions.md) that can load on demand into an iTwin.js frontend application

## Web browser compatibility

See [Supported Platforms Page](../SupportedPlatforms.md#Supported-Browsers)
