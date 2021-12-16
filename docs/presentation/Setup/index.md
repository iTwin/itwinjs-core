# Setting Up iTwin.js Presentation Library

Before the Presentation library can be used, it needs to be properly initialized. Because of the nature of [iTwin.js architecture](../../SoftwareArchitecture.md), the library needs to be initialized on the backend and each frontend that is in use — just like the iTwin.js framework itself.

## Backend

There are 2 main steps to enable Presentation library usage:

1. Register `PresentationRpcInterface` when initializing `IModelHost`. The way it's done depends on [IModelHost specialization](../../backend/IModelHost.md#imodelhost-specializations), but in any case that's similar to how any other `RpcInterface` is registered. A couple of examples:
   - For a **web app**, `IModelHost` has to be initialized first and required RPC interfaces need to be passed to `BentleyCloudRpcManager.initializeImpl`:

      ```ts
      [[include:Presentation.Common.RpcInterface.Imports]]
      [[include:Presentation.Common.RpcInterface]]
      [[include:Presentation.Backend.WebApp.RpcInterface]]
      ```

   - For an **Electron app**, required RPC interfaces are passed straight into `ElectronHost.startup`:

      ```ts
      [[include:Presentation.Common.RpcInterface.Imports]]
      [[include:Presentation.Common.RpcInterface]]
      [[include:Presentation.Backend.Electron.RpcInterface]]
      ```

2. Initialize Presentation backend:

   ```ts
   [[include:Presentation.Backend.Initialization.Imports]]
   [[include:Presentation.Backend.Initialization.Props]]
   [[include:Presentation.Backend.Initialization]]
   ```

## Frontend

Similar to the backend, the frontend initialization consists of 2 steps:

1. Register `PresentationRpcInterface` when initializing `IModelApp`. That's done by making sure the interface is included into the list of `rpcInterfaces` when calling `startup` on `IModelApp` or one of [its specializations](../../frontend/IModelApp.md#imodelapp-specializations).

   ``` ts
   [[include:Presentation.Common.RpcInterface.Imports]]
   [[include:Presentation.Common.RpcInterface]]
   [[include:Presentation.Frontend.RpcInterface.Options]]
   [[include:Presentation.Frontend.IModelAppStartup]]
   ```

   **Note:** The above example uses `ElectronApp`, but it's similar with other specializations like `WebViewerApp`.

2. Initialize Presentation frontend:

   ``` ts
   [[include:Presentation.Frontend.Imports]]
   [[include:Presentation.Frontend.Initialization]]
   ```
