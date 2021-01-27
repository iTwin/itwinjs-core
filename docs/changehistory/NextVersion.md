---
publish: false
---
# NextVersion

## Updated version of Electron

Updated recommended version of Electron from 10.1.3 to 11.1.0. Note that Electron is specified as a peer dependency in iModel.js - so it's recommended but not mandatory that applications migrate to this electron version.

## IpcSocket for use with dedicated backends

For cases where a frontend and backend are explicitly paired (e.g. desktop and mobile apps), a more direct communication path is now supported via the [IpcSocket api]($docs/learning/IpcInterface.md). See the [Rpc vs Ipc learning article]($docs/learning/RpcVsIpc.md) for more details.

## External textures

Previously, all texture image data was embedded directly within iModel tiles. Now, when enabled, texture image data will be requested separate of the tile contents when the image data is considered large enough by the backend. This can reduce bandwidth and reduce memory consumption on the frontend.

To enable usage of external textures, set the `enableExternalTextures` property of [TileAdmin.Props]($frontend) to true when passed in to [TileAdmin.create]($frontend). This [TileAdmins.Props[($frontend) object should be passed in to [IModelApp.startup]($frontend).

## Breaking API Changes

### Electron Initialization

The `@beta` API's for desktop applications to use Electron via the `@bentley/electron-manager` package have been simplified substantially. Existing code will need to be adjusted to work with this version. The class `ElectronManager` has been removed, and it is now replaced with the classes `ElectronBackend` and `ElectronFrontend`.

To create an Electron application, you should initialize your frontend via:

```ts
  import { ElectronFrontend } from "@bentley/electron-manager/lib/ElectronFrontend";
  ElectronFrontend.initialize({ rpcInterfaces });
```

And your backend via:

```ts
  import { ElectronBackend } from "@bentley/electron-manager/lib/ElectronBackend";
  ElectronBackend.initialize({ rpcInterfaces });
```

> Note that the class `ElectronRpcManager` is now initialized internally by the calls above, and you do not need to initialize it directly.
