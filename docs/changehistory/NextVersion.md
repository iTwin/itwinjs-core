---
publish: false
---
# NextVersion

## Custom particle effects

 The display system now makes it easy to implement [particle effects](https://en.wikipedia.org/wiki/Particle_system) using [decorators](../learning/frontend/ViewDecorations.md). Particle effects simulate phenomena like fire, smoke, snow, and rain by animating hundreds or thousands of small particles. The new [ParticleCollectionBuilder]($frontend) API allows such collections to be efficiently created and rendered.

 The frontend-devtools package contains an example [SnowEffect]($frontend-devtools), as illustrated in the still image below. When applied to a viewport, the effect is animated, of course.
 ![Snow particle effect](./assets/snow.jpg)

## Updated version of Electron

Updated recommended version of Electron from 10.1.3 to 11.1.0. Note that Electron is specified as a peer dependency in iModel.js - so it's recommended but not mandatory that applications migrate to this electron version.

## IpcSocket for use with dedicated backends

For cases where a frontend and backend are explicitly paired (e.g. desktop and mobile apps), a more direct communication path is now supported via the [IpcSocket api]($docs/learning/IpcInterface.md). See the [Rpc vs Ipc learning article]($docs/learning/RpcVsIpc.md) for more details.

## External textures

By default, a tile containing textured materials embeds the texture images as JPEGs or PNGs. This increases the size of the tile, wasting bandwidth. A new alternative requires only the Id of the texture element to be included in the tile; the image can be requested separately. Texture images are cached, so the image need only be requested once no matter how many tiles reference it.

This feature is currently disabled by default. Enabling it requires the use of APIs currently marked `@alpha`. Pass to [IModelApp.startup]($frontend) a `TileAdmin` with the feature enabled as follows:

```ts
  const tileAdminProps: TileAdmin.Props = { enableExternalTextures: true };
  const tileAdmin = TileAdmin.create(tileAdminProps);
  IModelApp.startup({ tileAdmin });
```

## Changes to [IModelDb.close]($backend) and [IModelDb.saveChanges]($backend)

Previously, [IModelDb.close]($backend) would save any uncommitted changes to disk before closing the iModel. It no longer does so - instead, if uncommitted changes exist when the iModel is closed, they will be discarded. Applications should explicitly call either [IModelDb.saveChanges]($backend) to commit the changes or [IModelDb.abandonChanges]($backend) to discard them before calling `close`.

In rare circumstances, [IModelDb.saveChanges]($backend) may now throw an exception. This indicates a fatal condition like exhaustion of memory or disk space. Applications should wrap calls to `saveChanges` in a `try-catch` block and handle exceptions by terminating without making further use of the iModel. In particular, they should not attempt to call `close`, `saveChanges`, or `abandonChanges` after such an exception has occurred.

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
