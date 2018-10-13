# App Tailoring

While the bulk of an iModel.js app is portable, it must also be tailored to fit each configuration and platform well. The app's UI and functionality can vary by configuration. And, the app can integrate platform-specific functionality.

## App Packaging and Deployment

And app is prepared for deployment by "last mile" scripts. Different scripts will be used to package and deploy Web apps, Electron apps, and mobile apps. The packaging of the app will vary by configuration and target platform. The scripts will normally select different entry points for different deployments, as explained next.

## Configuration-Specific Main

An app [frontend](../learning/Glossary.md#frontend) typically has a different "main" for each configuration to do the following:
* Change the app's UI and functionality to suit the configuration and platform.
  * Do platform-specific initialization:
    * UI "chrome"
    * Entitlements
    * Other platform integration
  * [Tailor the GUI](#change-the-gui)
* [Configure interfaces on the client side](../learning/RpcInterface.md#client-side-configuration).
    * You may apply the [backends-for-frontends pattern](#backends-for-frontends).
    * Web apps have several configuration options, as described in [the article on writing an interactive Web app](./WriteAnInteractiveWebApp.md).

An app [backend](../learning/Glossary.md#backend) typically has a different "main" for each configuation. For more information, see:
* [Web app](../learning/WriteAnInteractiveWebApp.md)
* [Desktop app](../learning/WriteAnInteractiveDesktopApp.md)
* [Mobile app](../learning/WriteAnInteractiveMobileApp.md)

The last-mile packaging and deployment scripts select the appropriate main for frontend and backend.

## Change the GUI

An app's UI is contained within its frontend. The look and feel of the GUI is largely contained within its HTML and CSS resources. Swapping in a different GUI can be a simple as swapping in a different style sheet or HTML page, leaving the supporting JavaScript the same. You can develop and test the various version of the GUI in a single development environment. You can also write the frontend JavaScript to tailor the GUI at run time. Configuring the UI is generally done in the configuration- and platform-specific frontend main.

## Use Platform-specific Modules

An interactive app can use platform-specific modules that are supplied by the host platform in JavaScript. Mobile platforms such as iOS and Android, provide JavaScript classes for services that are specific to mobile apps. The Electron desktop platform provides all of the features of nodejs. Platform-specific modules must be used in [guarded code](../learning/Portability.md).

## Backends for Frontends

Following the [backends-for-frontends pattern](https://samnewman.io/patterns/architectural/bff/), an app would ideally use different backend services for different configurations, rather than trying to rely on a one-size-fits-all backend service. The iModel.js [RpcInterface](./RpcInterface.md) architecture encourages and supports the BFF pattern. It is easy to write and deploy app-specific backends, because a backend is just a TypeScript class that deals only with the app's functionality, not communication details. It is easy for an app to choose the mix of backend services that match its configuration, because RpcInterfaces, as TypeScript classes, are first class objects that can be managed at runtime.
