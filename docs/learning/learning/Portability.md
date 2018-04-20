# Portability

The technology used by iModelJs makes it possible to write an app once and then deploy it to run on many platforms without modification.

## Cross-Platform Technologies
The key technology that makes an app portable is JavaScript. JavaScript engines are available on many operating systems and Web browsers. TypeScript compiles to JavaScript.

[Nodejs](./Glossary.md#Node.js) is an execution environment for agents, services, and servers. Nodejs runs JavaScript programs. Nodejs itself runs on many platforms, including Windows and Linux. Nodejs is also widely supported by cloud infrastructures and deployment mechanisms.

Web UI technology, including HTML and CSS, makes it possible to write a cross-platform user interface that looks and behaves the same everywhere, in every configuration. Web UI technology is supported by Web browsers and Web view renderers on many platforms.

[Electron](./Glossary.md#Electron) combines a Web view client and a nodejs-based server into a single desktop product, without requiring any modification of the code or the UI. Electron runs on many desktop platforms.

## Frontend Portability

Since an iModelJs app [frontend](../../overview/overview/App.md#app-frontend) is written using Web UI technologies, it is inherently portable.

## Backend Portability

Services and agents always run in nodejs. And, they always use server technology.

App-specific backends do not always run in nodejs and do not always user server technology. This section describes how to make them portable and adaptable to multiple app configurations.

A few lines of an app-specific backend's main entry point must be different, depending on whether it is configured as a mobile app or not. For the mobile case, a special gateway request processor should be imported and initialized. For the non-mobile case, normal Web server packages should be imported and initialized.

A backend can use node builtins, but only in guarded code.

A backend can use the following portable imodeljs-backend classes to avoid unnecessary node dependencies:

|Node builtin|imodeljs-backend portable substitute|
|---|---|---|
|fs|IModelJsFs
|os|Platform
|process|Platform
|__dirname|KnownLocations
|__filename|KnownLocations
|console|Logger
|path|path|

In most cases, the imodeljs-backend substitutes do *not* provide all of the properties of the node global. That is by design, as not all of the features offered by node are portable. Only a partial implementation of `path` is provided on non-nodejs platforms.

An app backend must not *never* depend on node-specific packages, including any package that is based on native code. (For fs-extra, use IModelJsFs)

## Gateway Portability

Since frontends talk to backends via a [gateways](../../overview/overview/App.md#gateways) and gateways are TypeScript classes, and since gateway transport configuration does not affect the frontend or the backend code, frontend-backend communication is inherently portable.

That said, the initialization logic of both frontend and backend must choose the correct gateway configurations, based on the app's configuration.

## Platform-specific Modules
A portable interactive app can use platform-specific modules that are supplied by the host platform in JavaScript. These should be used in guarded code.

