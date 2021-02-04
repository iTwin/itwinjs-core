---
publish: false
---
# NextVersion

## Updated version of Electron

Updated recommended version of Electron from 10.1.3 to 11.1.0. Note that Electron is specified as a peer dependency in iModel.js - so it's recommended but not mandatory that applications migrate to this electron version.

## IpcSocket for use with dedicated backends

For cases where a frontend and backend are explicitly paired (e.g. desktop and mobile apps), a more direct communication path is now supported via the [IpcSocket api]($docs/learning/IpcInterface.md). See the [Rpc vs Ipc learning article]($docs/learning/RpcVsIpc.md) for more details.

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

### Update element behavior

In order to support partial updates and clearing an existing value, the update element behavior has been enhanced/changed with regard to how `undefined` values are handled.
The new behavior is documented as part of the method documentation here:

[IModelDb.Elements.updateElement]($backend)

## Presentation

### Setting up default formats

A new feature was introduced, which allows us to supply a map of default unit formats to use for formatting properties that don't have a presentation format in requested unit system.
These formats are stored in a `defaultFormats` map which can be viewed in `presentation-backend\PresentationManagerProps.defaultFormats`.

To setup `DefaultFormats`, `Phenomenon`, array of `UnitSystem` and `FormatProps` need to be specified in the map like so:

```ts
const defaultFormats = {
          length: { unitSystems: [PresentationUnitSystem.BritishImperial], format: formatPropsLength },
          area: { unitSystems: [PresentationUnitSystem.UsCustomary, PresentationUnitSystem.UsSurvey], format: formatPropsAre },
        };
```

Phenomenon's name is case-insensitive.
