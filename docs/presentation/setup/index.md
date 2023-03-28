# Setting up iTwin.js Presentation library

Before the Presentation library can be used, it needs to be properly initialized. Because of the nature of [iTwin.js architecture](../../SoftwareArchitecture.md), the library needs to be initialized on the backend and each frontend that is in use — just like the iTwin.js framework itself.

## Backend

There are 2 main steps to enable Presentation library usage:

1. Register [PresentationRpcInterface]($presentation-common) when initializing [IModelHost]($core-backend). The way it's done depends on [IModelHost specialization](../../backend/IModelHost.md#imodelhost-specializations), but in any case that's similar to how any other [RpcInterface]($core-common) is registered. A couple of examples:

   - For a **web app**, [IModelHost]($core-backend) has to be initialized first and required RPC interfaces need to be passed to [BentleyCloudRpcManager.initializeImpl]($core-common):

      ```ts
      [[include:Presentation.Common.RpcInterface.Imports]]
      [[include:Presentation.Common.RpcInterface]]
      [[include:Presentation.Backend.WebApp.RpcInterface]]
      ```

   - For an **Electron app**, required RPC interfaces are passed straight into [ElectronHost.startup]($core-electron):

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

Similar to the backend, the frontend initialization consists of 3 steps:

1. Initialize [IModelApp]($core-frontend).

   ``` ts
   [[include:Presentation.Frontend.IModelAppStartup]]
   ```

2. Register [PresentationRpcInterface]($presentation-common) when RPC system. That's done by making sure the interface is included into the list of RPC interfaces when initializing one of the RPC managers. The below example uses [BentleyCloudRpcManager]($core-common).

   ``` ts
   [[include:Presentation.Common.RpcInterface.Imports]]
   [[include:Presentation.Common.RpcInterface]]
   [[include:Presentation.Frontend.RpcInterface.Options]]
   ```

3. Initialize Presentation frontend:

   ``` ts
   [[include:Presentation.Frontend.Imports]]
   [[include:Presentation.Frontend.Initialization]]
   ```
