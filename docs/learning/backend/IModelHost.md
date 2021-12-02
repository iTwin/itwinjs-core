# IModelHost

Every iTwin.js [backend](../Glossary.md#backend) must call [IModelHost.startup]($backend) (usually indirectly via a specialized host, see below) before using any backend services. [IModelHost]($backend) initializes the pieces of a backend to allow it to access iModels and serve [IModelApp]($frontend)s.

## IModelHost Specializations

To support the various use cases and platforms for iTwin.js backends, there are specialized "hosts" that should be used where appropriate. Each specialization supplies static methods that may be used for its relevant services.

> For a given backend, you will pick *one* class from the following list, and call its `startup` method. The type of host running on the backend determines the type of [IModelApp](../frontend/IModelApp.md) that can be used on the frontend.

- **[IModelHost]($backend)**: supports all configurations and must always be initialized. `IModelHost` may be used directly for "Agents" that don't connect to any frontends.
  - **[IpcHost]($backend):** may be used when a backend is *dedicated* to and paired with a single frontend [IpcApp]($frontend) so they may use Ipc. If either end terminates, the other must also. [IpcHost.startup]($backend) calls [IModelHost.startup]($backend). `IpcHost` is abstract, and you should not use it directly.
    - **`WebEditHost`**: for the backend of a `WebEditApp` for editing iModels over the web. `WebEditHost.startup` creates web socket and calls [IpcHost.Startup]($backend).
    - **[NativeHost]($backend)**: may be used when the frontend and backend are separate processes on the same computer. [NativeHost.startup]($backend) calls [IpcHost.startup]($backend). `NativeHost` also provides access to local file system
      - **`ElectronHost`**: for desktop apps on Windows, Mac, and Linux. `ElectronHost.startup` calls [NativeHost.startup]($backend),
      - **`MobileHost`**: for mobile apps. `MobileHost.startup`calls [NativeHost.startup]($backend) and performs Mobile application startup procedures. `MobileHost` is abstract and should not be used directly.
        - **`IOSHost`**: for iOS backends. `IOSHost.startup` calls `MobileHost.startup` and performs iOS-specific startup procedures.
        - **`AndroidHost`**: for Android backends. `AndroidHost.startup` calls `MobileHost.startup` and performs Android-specific startup procedures.

A backend may need to set [IModelHostConfiguration.appAssetsDir]($backend) to identify its own assets directory. This would be needed, for example, if the app [imports ECSchemas](./SchemasAndElementsInTypeScript.md).

*Example:*

```ts
[[include:IModelHost.startup]]
```
