# Portability

This article describes the technologies and best practices that make iModelJs apps portable. An well-written iModelJs app will run on many platforms without modification.

In addition, a well-written interactive app can be configured to run as a Web abb, a desktop app, and a mobile app, with a few simple runtime checks and no other code changes. Configurability does not mean that an iModelJs app must be the same in all configurations. In fact, the iModelJs architecture makes it easy to [make the app fit the platform](../overview/App.md#making-interactive-apps-fit-the-platform).

This degree of portability and configurability is possible because of the technologies used by iModelJs apps and the iModelJs app architecture.

## Cross-Platform Technologies

The key technology that makes an app portable is JavaScript. JavaScript engines are available on many operating systems and Web browsers. TypeScript compiles to JavaScript.

[Nodejs](./Glossary.md#Node.js) is an execution environment for agents, services, and servers. Nodejs runs JavaScript programs. Nodejs itself runs on many platforms, including Windows and Linux. Nodejs is also widely supported by cloud infrastructures and deployment mechanisms.

Web UI technology, including HTML and CSS, makes it possible to write a cross-platform user interface that looks and behaves the same everywhere, in every configuration. Web UI technology is supported by Web browsers and Web view renderers on many platforms. Web UI technology also simplifies the task of reconfiguring or even swapping out an app's GUI.

[Electron](./Glossary.md#Electron) combines a Web view client and a nodejs-based server into a single desktop product, without requiring any modification of the code or the UI. Electron runs on many desktop platforms.

## Frontend Portability

Since an iModelJs app [frontend](../overview/App.md#app-frontend) is written using Web UI technologies, it is inherently portable.

The frontend's main script must check the app's configuration to decide what RpcInterface configuration to use for its app-specific backend(s):
* Mobile app - [in-process RPC configuration](../overview/App.md#in-process-rpc-configuration).
* Desktop app - [desktop RPC configuration](../overview/App.md#desktop-rpc-configuration).
* Web app - [cloud PRC configuration](../overview/App.md#cloud-rpc-configuration).

The frontend will always use the [cloud RPC configuration](../overview/App.md#cloud-rpc-configuration) for services.

## Backend Portability

### Services and Agents
True services and agents are easy to make portable, since they always run in nodejs and they always run on a server. Services always run a Web server and always use the [cloud RPC configuration](../overview/App.md#cloud-rpc-configuration). Note that an iModelJs service or agent does not deal directly with issues such as deployment, routing, or scaling. Those are the concerns of the cloud infrastructure. As nodejs apps, iModelJs services and agents are cloud-neutral and run on many cloud infrastructures.

### App Backends
App-specific backends do not always run in nodejs, and they do not always run on a server. This section describes how to make an app-specific backend portable and adaptable to multiple app configurations.

An app-specific backend's main script must check the app's configuration to decide how it should initialize and run:
* Mobile app - the backend should run the in-process RPC request processor and use the [in-process RPC configuration](../overview/App.md#in-process-rpc-configuration).
* Desktop app - the backend should run a Web server and use the [desktop RPC configuration](../overview/App.md#desktop-rpc-configuration).
* Web app - the backend should run a Web server and use the [cloud RPC configuration](../overview/App.md#cloud-rpc-configuration).

*Example:*
```ts
[[include:RpcInterface.initializeImpl]]
```

A backend can use node builtins, but only in guarded code.

*TBD: Sample Code*

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

## Platform-specific Modules

A portable interactive app can use platform-specific modules that are supplied by the host platform in JavaScript. These should be used in guarded code.
