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

## External textures

By default, a tile containing textured materials embeds the texture images as JPEGs or PNGs. This increases the size of the tile, wasting bandwidth. A new alternative requires only the Id of the texture element to be included in the tile; the image can be requested separately. Texture images are cached, so the image need only be requested once no matter how many tiles reference it.

This feature is currently disabled by default. Enabling it requires the use of APIs currently marked `@alpha`. Pass to [IModelApp.startup]($frontend) a `TileAdmin` with the feature enabled as follows:

```ts
  const tileAdminProps: TileAdmin.Props = { enableExternalTextures: true };
  const tileAdmin = TileAdmin.create(tileAdminProps);
   IModelApp.startup({ tileAdmin });
```

## IModelHost and IModelApp Initialization Changes

Initialization processing of iModel.js applications, and in particular the order of individual steps for frontend and backend.js classes has been complicated and vague, involving several steps that vary depending on application type and platform. This release attempts to clarify and simplify that process, while maintaining backwards compatibility. In general, if your code uses [IModelHost.startup]($backend)` and [IModelApp.startup]($frontend) for web visualization, it will continue to work without changes. However, for native (desktop and mobile) apps, some refactoring may be necessary. See [IModelHost documentation]($docs/learning/backend/IModelHost.md) for appropriate backend initialization, and [IModelApp documentation]($docs/learning/frontend/IModelApp.md) for frontend initialization.

The `@beta` API's for desktop applications to use Electron via the `@bentley/electron-manager` package have been simplified substantially. Existing code will need to be adjusted to work with this version. The class `ElectronManager` has been removed, and it is now replaced with the classes `ElectronHost` and `ElectronApp`.

To create an Electron application, you should initialize your frontend via:

```ts
  import { ElectronApp } from "@bentley/electron-manager/lib/ElectronFrontend";
  ...
  await ElectronApp.startup();
```

And your backend via:

```ts
  import { ElectronHost } from "@bentley/electron-manager/lib/ElectronBackend";
  ...
  await ElectronHost.startup();
```

Likewise, to create an iOS application, you should initialize your frontend via:

```ts
  import { IOSApp } from "@bentley/mobile-manager/lib/MobileFrontend";
  ...
  await IOSApp.startup();
```

And your backend via:

```ts
  import { IOSHost } from "@bentley/mobile-manager/lib/MobileBackend";
  ...
  await IOSHost.startup();
```

Both frontend and backend `startup` methods take optional arguments to customize the App/Host environments.

## ProcessDetector API

It is frequently necessary to detect the type of JavaScript process currently executing. Previously, there were several ways (sometimes redundant, sometimes conflicting) to do that, depending on the subsystem being used. This release attempts to centralize process classification into the class [ProcessDetector]($bentley) in the `@bentleyjs-core` package. All previous methods for detecting process type have been deprecated in favor of `ProcessDetector`. The deprecated methods will likely be removed in version 3.0.

## Breaking API Changes

### Update element behavior

To support partial updates and clearing an existing value, the update element behavior has been enhanced/changed with regard to how `undefined` values are handled.
The new behavior is documented as part of the method documentation here:

[IModelDb.Elements.updateElement]($backend)

### Moving properties within an existing ECSchema

ECDb now supports moving properties within the existing class hierarchy. Columns will be remapped or data will be moved to match the new structure.
Inserting a new base class in the middle of the hierarchy which has properties is now also supported.
As this requires data modifications during schema updates, we will no longer support reverse and reinstate on schema changesets. Attempts to do so will now raise an error.
`ChangeStatus.ChangeSetStatus.ReverseOrReinstateSchemaChangesOnOpen` renamed to `ChangeStatus.ChangeSetStatus.ReverseOrReinstateSchemaChanges`.

## Presentation

### Setting up default formats

A new feature was introduced, which allows supplying default unit formats to use for formatting properties that don't have a presentation unit for requested unit system. The formats are set when initializing [Presentation]($presentation-backend) and passing [PresentationManagerProps.defaultFormats]($presentation-backend).
Example:

```ts
Presentation.initialize({
  defaultFormats: {
    length: {
      unitSystems: [PresentationUnitSystem.BritishImperial],
      format: MY_DEFAULT_FORMAT_FOR_LENGTHS_IN_BRITISH_IMPERIAL_UNITS,
    },
    area: {
      unitSystems: [PresentationUnitSystem.UsCustomary, PresentationUnitSystem.UsSurvey],
      format: MY_DEFAULT_FORMAT_FOR_AREAS_IN_US_UNITS,
    },
  },
});
```

### Accessing selection in instance filter of content specifications

Added a way to create and filter content that's related to given input through some ID type of property that is not part of a relationship. That can be done by
using [ContentInstancesOfSpecificClasses specification](../learning/presentation/content/ContentInstancesOfSpecificClasses.md) with an instance filter that makes use
of the newly added [SelectedInstanceKeys](../learning/presentation/content/ECExpressions.md#instance=filter) ECExpression symbol. Example:

```json
{
  "ruleType": "Content",
  "condition": "SelectedNode.IsOfClass(\"ECClassDef\", \"ECDbMeta\")",
  "specifications": [
    {
      "specType": "ContentInstancesOfSpecificClasses",
      "classes": {
        "schemaName": "BisCore",
        "classNames": ["Element"]
      },
      "arePolymorphic": true,
      "instanceFilter": "SelectedInstanceKeys.AnyMatches(x => this.IsOfClass(x.ECInstanceId))"
    }
  ]
}
```
The above example creates content for `ECDbMeta.ECClassDef` instances by selecting all `BisCore.Element` instances
that are of given `ECDbMeta.ECClassDef` instances.

Previously this was not possible, because there is no ECRelationship between `ECDbMeta.ECClassDef` and `BisCore.Element`.

