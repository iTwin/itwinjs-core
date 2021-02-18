# Write An Interactive App

An [interactive iTwin.js app](../learning/App.md#interactive-apps) has two components or layers:

- [frontend](./Glossary.md#frontend) = user interface and display
- [backend](./Glossary.md#backend) = iModel access

[Simple Viewer App](https://github.com/imodeljs/imodeljs-samples/tree/master/interactive-app/simple-viewer-app) is a complete example of an interactive app.

## 1. Write the Frontend

See the [frontend learning articles](./frontend/index.md).

## 2. Write the Backend and/or choose existing backends

Some apps can use an already deployed Web service. In that case, there is no need to write a backend. Just write the frontend's main to [point to the remote service](./RpcInterface.md#client-side-configuration).

To write a [customized backend](../learning/App.md#app-backend), see the [backend learning articles](./backend/index.md).

Note that the backend of an *interactive* app typically does not open an iModel on its own initiative. Instead, the app frontend will ask the backend to open an iModel, and then the frontend will pass the resulting [IModelRpcProps]($common) to methods of the backend. The backend should therefore always initialize the [IModelReadRpcInterface]($common).

## 3. Tailor, Package, and Deploy the App

An interactive app must be tailored to match each desired [configuration](../learning/App.md#configurations) and sometimes each target platform. It must then be packaged and deployed using appropriate tools. For more information, see:

- [Interactive Web app](./WriteAnInteractiveWebApp.md)
- [Interactive desktop app](./WriteAnInteractiveDesktopApp.md)
- [Interactive mobile app](./WriteAnInteractiveMobileApp.md)
