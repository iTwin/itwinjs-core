# IModelHost

Every iModel.js [backend](../Glossary.md#backend) must call [IModelHost.startup]($backend) (usually indirectly via a specialized host, see below) before using any backend services. [IModelHost]($backend) initializes imodeljs-backend so that it may access iModels and serve [IModelApp]($frontend)s.

## IModelHost Specializations

To support the various use cases and platforms for iModel.js backends, there are specialized "hosts" that should be used where appropriate. Each specialization supplies static methods that may be used for its relevant services.

> For a given backend, you will pick *one* class from the following list, and call its `startup` method. The type of host running on the backend determines the type of [IModelApp](../frontend/IModelApp.md) that can be used on the frontend.

- **[IModelHost]($backend)**: supports all configurations and must always be initialized. `IModelHost` may be used directly for "Agents" that don't connect to any frontends.
  - **[WebViewerHost]($backend)**: for the backend of web viewing applications using [WebViewerApp]($frontend). They are generally deployed on cloud-based VMs through an orchestration service. They only support RPC and all connections are made through HTTP so requests may be directed to any equivalent instances. They may be started/stopped according to demand. [WebViewerHost.startup]($backend) calls [IModelHost.startup]($backend).
  - **[IpcHost]($backend):** may be used when a backend is *dedicated* to and paired with a single frontend [IpcApp]($frontend) so they may use Ipc. If either end terminates, the other must also. [IpcHost.startup]($backend) calls [IModelHost.startup]($backend). `IpcHost` is abstract, and you should not use it directly.
    - **[WebEditHost]($backend)**: for the backend of a [WebEditApp]($frontend) for editing iModels over the web. [WebEditHost.startup]($backend) creates web socket and calls [IpcHost.Startup]($backend).
    - **[NativeHost]($backend)**: may be used when the frontend and backend are separate processes on the same computer. [NativeHost.startup]($backend) calls [IpcHost.startup]($backend). `NativeHost` also provides access to local file system
      - **[ElectronHost]($backend)**: for desktop apps on Windows, Mac, and Linux. [ElectronHost.startup]($backend) calls [NativeHost.startup]($backend),
      - **[MobileHost]($backend)**: for mobile apps. [MobileHost.startup]($backend) calls [NativeHost.startup]($backend) and performs Mobile application startup procedures. `MobileHost` is abstract and should not be used directly.
        - **[IOSHost](%backend)**: for iOS backends. [IOSHost.startup]($backend) calls [MobileHost.startup]($backend) and performs iOS-specific startup procedures.
        - **[AndroidHost]($backend)**: for Android backends. [AndroidHost.startup]($backend) calls [MobileHost.startup]($backend) and performs Android-specific startup procedures.

A backend may need to set [IModelHostConfiguration.appAssetsDir]($backend) to identify its own assets directory. This would be needed, for example, if the app [imports ECSchemas](./SchemasAndElementsInTypeScript.md).

*Example:*

 ```ts
 [[include:IModelHost.startup]]
 ```
