---
publish: false
---
# NextVersion

## Update minimum requirements

Support for Node 10 has been dropped. The new minimum Node version is 12.22.0. The recommended version is the latest LTS version of Node. Please visit our [Supported Platforms](../learning/supportedplatforms) documentation for a full breakdown of compatibility.

## Dependency Updates

The following dependencies of iTwin.js have been updated;

- `openid-client` updated to from `^3.15.3` -> `^4.7.4`,

## Build tools changes

- Removed `test` and `test-tsnode` scripts from `@bentley/build-tools`.  Please use mocha directly instead.
- Removed TSLint support from `@bentley/build-tools`. If you're still using it, please switch to ESLint.
- Removed legacy `.eslintrc.js` file from the same package. Instead, use `@bentley/eslint-plugin` and the `imodeljs-recommended` config included in it.

## BentleyError constructor no longer logs

In V2, the constructor of the base exception class [BentleyError]($bentleyjs-core) accepted 5 arguments, the last 3 being optional. Arguments 3 and 4 were for logging the exception in the constructor itself. That is a bad idea, since exceptions are often handled and recovered in `catch` statements, so there is no actual "problem" to report. In that case the message in the log is either misleading or just plain wrong. Also, code in `catch` statements always has more "context" about *why* the error may have happened than the lower level code that threw (e.g. "invalid Id" vs. "invalid MyHashClass Id") so log messages from callers can be more helpful than from callees. Since every thrown exception must be caught *somewhere*, logging should be done when exceptions are caught, not when they're thrown.

The [BentleyError]($bentleyjs-core) constructor now accepts 3 arguments, the last argument (`getMetaData`) is optional. The previous `log` and `category` arguments were removed. If your code passed 5 arguments, remove the 3rd and 4th. If you previously passed 3 or 4 arguments, just leave the first two.

## ClientRequestContext.current has been removed

The class [ClientRequestContext]($bentleyjs-core) exists to identify RPC requests between a web frontend and a cloud backend. In V2, had a static (i.e. global) member called `current` whose purpose was to identify the *current request* for logging from the backend. The members of `ClientRequestContext` called `sessionId` and `activityId` were "magically" appended in log messages without the need for passing the current request context as an argument. That originally seemed like a good idea, but became hopelessly complicated as asynchronous code was introduced. That's because when async methods run, there can be many request contexts extant simultaneously. So, it became the job of all code that awaited an async function to accept an argument with a request context and call `.enter()` on it, to set the very global variable whose existence was solely to avoid having to have the argument in the first place! Needless to say, global variables and `async`s don't mix and the whole concept has been removed.

If you have code that has something like this:

```ts
requestContext.enter();
```

you can simply delete it. If your function accepts a [ClientRequestContext]($bentleyjs-core) merely to call `enter` on it, consider refactoring your code to remove the argument.

This change mostly affects backend code. For backend [RPC]($docs/learning/RpcInterface.md) implementations, all *unhandled* exceptions will automatically be logged along the appropriate `ClientRequestContext`. For this reason, it often preferable to throw an exception rather than logging an error and returning a status in code that may or may not be called from RPC.

## Viewport.zoomToElements improvements

[Viewport.zoomToElements]($frontend) accepts any number of element Ids and fits the viewport to the union of their [Placement]($common)s. A handful of shortcomings of the previous implementation have been addressed:

- Previously, the element Ids were passed to [IModelConnection.Elements.getProps]($frontend), which returned **all** of the element's properties (potentially many megabytes of data), only to extract the [PlacementProps]($common) for each element and discard the rest. Now, it uses the new [IModelConnection.Elements.getPlacements]($frontend) function to query only the placements.
- Previously, if a mix of 2d and 3d elements were specified, the viewport would attempt to union their 2d and 3d placements, typically causing it to fit incorrectly because 2d elements reside in a different coordinate space than 3d elements. Now, the viewport ignores 2d elements if it is viewing a 3d view, and vice-versa.

## Continued transition to `ChangesetIndex`

Every Changeset has both an Id (a string hash of its content and parent changeset) and an Index (a small integer representing its relative position on the iModel's timeline.) Either value can be used to uniquely identify a changeset. However, it is often necessary to compare two changeset identifiers to determine relative order, or to supply a range of changesets of interest. In this case, Id is not useful and must be converted to an index via a round-trip to an iModelHub server. Unfortunately, much of the iModel.js api uses only [ChangesetId]($common) to identify a changeset. That was unfortunate, since [ChangesetIndex]($common) is frequently needed and `ChangesetId` is rarely useful. For this reason we are migrating the api to prefer `ChangesetIndex` over several releases.

In version 2.19, we introduced the type [ChangesetIdWithIndex]($common) to begin that migration. However, for 2.x compatibility we could not use it several places where it would have been helpful:

- [IModelRpcOpenProps]($common)
- [CheckpointProps]($backend)
- [LocalBriefcaseProps]($common)

Each of these interfaces originally had only a member `changeSetId: string`, In 2.19, for backwards compatibility, a new member `changeSetIndex?: number` was added. In V3 those two members are now replaced with a single member `changeset: ChangesetIdWithIndex`. Note that this is a breaking change, and you may have to adjust your code. To get the changeset Id, use `changeset.id`. To get the changeset Index, use `changeset.index` (may be undefined). In V4, this will become `changeset: ChangesetIndexAndId` and index will be required.

> Note: "Changeset" is one word. Apis should not use a capital "S" when referring to them.

## ViewState3d.lookAt Arguments Changed

[ViewState3d.lookAt]($frontend) previously took 6 arguments. Also, the method `ViewState3d.lookAtUsingLensAngle` established a perspective `ViewState3d` from a field-of-view lens angle with many of the same arguments. There is now a new implementation of `ViewState3d.lookAt` that accepts named parameters to set up either a perspective or orthographic view, using the interfaces [LookAtPerspectiveArgs]($frontend), [LookAtOrthoArgs]($frontend), or [LookAtUsingLensAngle]($frontend).

This is a breaking change, so you may need to modify your code and replace the previous arguments with a single object with the appropriate names. For example,:

```ts
  viewState.lookAt(eye, target, upVector, newExtents, undefined, backDistance, opts);
```

can become:

```ts
  viewState.lookAt( {eyePoint: eye, targetPoint: target , upVector, newExtents, backDistance, opts} );
```

likewise

```ts
    viewState.lookAtUsingLensAngle(eye, target, up, lens, frontDistance, backDistance);
```

can become:

```ts
  viewState.lookAt( {eyePoint: eye, targetPoint: target , upVector: up, lensAngle: lens, frontDistance, backDistance} );

```

### OnViewExtentsError and MarginOptions Separated from ViewChangeOptions

The `opts` argument to [ViewState3d.lookAt]($frontend) was previously declared to be of type [ViewChangeOptions]($frontend). However, it only used the `onExtentsError` member to handle invalid view extents. That caused confusion because it led you to believe that [ViewState3d.lookAt]($frontend) performed a view change when it doesn't, it merely modifies the `ViewState3d`.

There is now a separate interface [OnViewExtentsError]($frontend) that `ViewState3d.lookAt` accepts it as its `opts` argument. Likewise, [ViewState3d.lookAtVolume]($frontend) and [ViewState3d.lookAtViewAlignedVolume]($frontend) accept "[MarginOptions]($frontend) & [OnViewExtentsError]($frontend)" as their `opts` argument.

## ViewFlags

### Immutability

[ViewFlags]($common) has long been a common source of surprising behavior. Consider the following code:

```ts
  function turnOnShadows(vp: Viewport) {
    vp.viewFlags.shadows = true;
  }
```

You could be forgiven for expecting the image displayed in the Viewport to include shadows after calling this function, but that will not be the case. Instead, you must write the function as follows:

```ts
  function turnOnShadows(vp: Viewport) {
    const vf = vp.viewFlags.clone();
    vf.shadows = true;
    vp.viewFlags = vf;
  }
```

To rectify this, and to eliminate various other pitfalls associated with mutable state, ViewFlags has been converted to an immutable type - all of its properties are read-only and the only way to change a property is to create a copy. The function above can now be written as:

```ts
  function turnOnShadows(vp: Viewport) {
    vp.viewFlags = vp.viewFlags.with("shadows", true);
    // or, equivalently, but less efficiently in this case:
    vp.viewFlags = vp.viewFlags.copy({ shadows: true });
  }
```

Methods that mutate a ViewFlags object have been removed.

- `clone` has been replaced with [ViewFlags.copy]($common), which returns a new object instead of modifying `this`.
- `createFrom` has been removed. Because ViewFlags is immutable, it is never necessary to create an identical copy of one - just use the same object. Or, if for some reason you really want an identical copy, use the object spread operator.

If your code used to modify a single property, change it to use [ViewFlags.with]($common) or [ViewFlags.withRenderMode]($common):

```ts
  // Replace this...
  viewport.viewFlags.clipVolume = true;
  // ...with this:
  viewport.viewFlags = viewFlags.with("clipVolume", true);
```

If your code used to modify multiple properties, change it to use [ViewFlags.copy]($common):

```ts
  // Replace this...
  viewport.viewFlags.shadows = viewport.viewFlags.lighting = true;
  // ...with this:
  viewport.viewFlags = viewport.viewFlags.copy({ shadows: true, lighting: true });
```

If your code used to create a new ViewFlags and then modify its properties, pass the initial properties to [ViewFlags.create]($common) instead:

```ts
  // Replace this...
  const vf = new ViewFlags();
  vf.shadows = vf.lighting = true;
  // ...with this:
  const vf = ViewFlags.create({ shadows: true, lighting: true });
```

### Removal of unused properties

The following deprecated [ViewFlagProps]($common) properties were removed: hlMatColors, edgeMask.

The following deprecated [ViewFlags]($common) properties were removed: noGeometryMap, hLineMaterialColors, edgeMask, noSolarLight, noCameraLights, noSourceLights.

If you were using noCameraLights, noSourceLights, or noSolarLight, use [ViewFlags.lighting]($common) instead. Set it to true if any of the old light-related properties were false.

### Construction

[ViewFlags.fromJSON]($common) accepts a [ViewFlagProps]($common), which is awkward and error-prone for reasons discussed in that type's documentation. The [ViewFlags.constructor]($common) - like the new [ViewFlags.create]($common) static method - now takes an optional [ViewFlagsProperties]($common), which has exactly the same properties as ViewFlags. Prefer to use either `create` or the constructor instead of `fromJSON`.

## ViewFlagOverrides

This cumbersome, inefficient class has been replaced with the identically-named [ViewFlagOverrides]($common) type, which is simply an interface that has all the same properties as [ViewFlags]($common), but each is optional. A flag is overridden if its value is not `undefined`.

Upgrade instructions:

```ts
  let ovrs = new ViewFlagOverrides(); // Old code - nothing overridden.
  let ovrs = { }; // New code

  let ovrs = new ViewFlagOverrides(viewFlags); // Old code - override everything according to a ViewFlags
  let ovrs = { ...viewFlags }; // New code

  ovrs.overrideAll(viewFlags); // Old code - override everything according to a ViewFlags
  ovrs = { ...viewFlags }; // New code.

  ovrs.setThematicDisplay(true); // Old code - override thematic display to be true.
  ovrs.thematicDisplay = true; // New code

  ovrs.clone(other); // Old code - make other be a copy of ovrs
  other = { ...other }; // New code

  ovrs.copyFrom(other); // Old code - make ovrs be a copy of other
  ovrs = { ...other }; // New code

  if (ovrs.isPresent(ViewFlagPresence.ThematicDisplay)) // Old code
  if (undefined !== ovrs.thematicDisplay) // New code

  ovrs.setPresent(ViewFlagPresence.ThematicDisplay) // Old code
  ovrs.thematicDisplay = value; // New code, where "value" is whatever value thematicDisplay was set to in the old code

  ovrs.clearPresent(ViewFlagPresence.ThematicDisplay) // Old code
  ovrs.thematicDisplay = undefined; // New code

  if (ovrs.anyOverridden()); // Old code - determine if any flags are overridden
  if (JsonUtils.isNonEmptyObject(ovrs)); // New code

  ovrs.clear(); // Old code - mark all flags as not overridden
  ovrs = { }; // New code

  ovrs.clearClipVolume(); // Old code - mark clip volume as not overridden
  ovrs.clipVolume = undefined; // New code

  const vf = ovrs.apply(viewFlags); // Old code - create a ViewFlags by applying the overrides to the input ViewFlags
  const vf = viewFlags.override(ovrs); // New code

  const props = ovrs.toJSON(); // Old code - obtain JSON representation
  const props = ovrs; // New code

  let ovrs = ViewFlagOverrides.fromJSON(props); // Old code - create from JSON representation
  let ovrs = { ...props }; // New code
```

## Moved utility types

The [AsyncFunction]($bentleyjs-core), [AsyncMethodsOf]($bentleyjs-core), and [PromiseReturnType]($bentleyjs-core) types have moved to the @bentley/bentleyjs-core package. The ones in @bentley/imodeljs-frontend have been deprecated.

## Removed default API keys

Previous versions of `@bentley/imodeljs-frontend` included API keys for Bing Maps, MapBox Imagery, and Cesium ION that would be used for _all_ iTwin.js applications. These common keys are no longer supported and will soon be disabled. All applications will now need to provide their own keys.

A valid [MapBox](https://www.mapbox.com/) key is required for display of map imagery in views with [BackgroundMapSettings.providerName]($common) set to "MapBoxProvider".

A valid [Bing Maps](https://www.bing.com/maps) key is required for:
- Display of map imagery in views with [BackgroundMapSettings.providerName]($common) set to "BingProvider".
- Location services supplied by [BingLocationProvider]($frontend), along with tools that use these services like [ViewGlobeLocationTool]($frontend).
- Elevation services supplied by [BingElevationProvider]($frontend), including accurate 3d terrain display.

A valid [Cesium ION](https://cesium.com/platform/cesium-ion/) key is required for:
- Display of 3d terrain in views with [TerrainSettings.providerName]($common) set to "CesiumWorldTerrain".
- Display of OpenStreetMap buildings.

[IModelAppOptions.mapLayerOptions]($frontend) can be used to configure keys for Bing Maps, MapBox, and/or any other map layer providers. [TileAdmin.Props.cesiumIonKey]($frontend) can be used to configure the Cesium ION key. For example, the following configures the Bing Maps and Cesium ION keys at startup:

```ts
const appOptions: IModelAppOptions = {
  mapLayerOptions: {
    BingMaps: {
      key: "some key",
      value: "key",
    },
  },
  tileAdmin: {
    cesiumIonKey: "key",
  },
};

await IModelApp.startup(appOptions);
```

## Concurrency Control

The previous implementation of `ConcurrencyControl` for locking elements has been replaced with the [LockControl]($backend) interface.

`ConcurrencyControl` relied on detecting a list of changed elements and deferring the acquisition of locks until the application called the asynchronous `request` method to acquire locks, after the fact, but before calling [BriefcaseDb.saveChanges]($backend). The new approach is to require applications to call the asynchronous [LockControl.acquireExclusiveLock]($backend) on elements before update or delete, and to call [LockControl.acquireSharedLock]($backend) on parents and models before insert. If an attempt is made to modify or insert without the required locks, an exception is thrown when the change is attempted. This will require tools to make the necessary lock calls.

Previously the concurrency "mode" was determined by applications when opening a briefcase. It is now established as a property of an iModel when it is first created (and "revision0" is uploaded.) By default, iModels use pessimistic (i.e. locks) mode, so all previously created iModels will require locks. If you pass `noLocks: true` as an argument to [BackendHubAccess.createNewIModel]($backend), a briefcase-local value is saved in rev0.bim before it is uploaded. Thereafter, all briefcases of that iModel will use use optimistic (i.e. no locks, change merging) mode, since everyone will use briefcases derived from rev0.bim. The value is inspected in the `BriefcaseDb.useLockServer` method called by [BriefcaseDb.open]($backend).

Locks apply to Elements only. The "schema lock" is acquired by exclusively locking element id 0x1 (the root subject id). Models are locked via their modeled element (which has the same id as the model)

See the [ConcurrencyControl]($docs/learning/backend/ConcurrencyControl.md) learning article for more information and examples.

## ITwinId

Several api's in **iTwin.js** refer to the "context" for an iModel, meaning the *project or asset* to which the iModel belongs, as its `contextId`. That is very confusing, as the term "context" is very overloaded in computer science in general, and in iTwin.js in particular. That is resolved in iTwin.js V3.0 by recognizing that every iModel exists within an **iTwin**, and every iTwin has a GUID called its `iTwinId`. All instances of `contextId` in public apis that mean *the iTwin for this iModel* are now replaced by `iTwinId`.

This is a breaking change for places like `IModel.contextId`. However, it should be a straightforward search-and-replace `contextId` -> `iTwinId` anywhere you get compilation errors in your code.

## BriefcaseManager, BriefcaseDb, and IModelDb changes

The signatures to several methods in [BriefcaseManager]($backend) and [BriefcaseDb]($backend) have been changed to make optional the previously required argument called `requestContext`. That argument was poorly named, but used only to supply a "user access token". Since anywhere briefcases are relevant, an authenticated user access token is available via the static method `IModelHost.getAccessToken`, this argument is rarely needed. The only case where a caller needs to supply that argument is for tests that wish to simulate multiple users via a single backend (which is not permitted outside of tests.) It is now optional and called `user`.

| Method                                   | New arguments                                         | notes                            |
| ---------------------------------------- | ----------------------------------------------------- | -------------------------------- |
| `BriefcaseDb.onOpen`                     | [OpenBriefcaseArgs]($backend)                         | event signature change           |
| `BriefcaseDb.onOpened`                   | [BriefcaseDb]($backend),[OpenBriefcaseArgs]($backend) | event signature change           |
| `BriefcaseDb.open`                       | [OpenBriefcaseArgs]($backend)                         |                                  |
| `BriefcaseDb.pullChanges`                | [PullChangesArgs]($backend)                           | was called `pullAndMergeChanges` |
| `BriefcaseDb.pushChanges`                | [PushChangesArgs]($backend)                           |                                  |
| `BriefcaseDb.upgradeSchemas`             | [OpenBriefcaseArgs]($backend)                         | `requestContext` removed         |
| `BriefcaseManager.acquireNewBriefcaseId` | [IModelIdArg]($backend)                               |                                  |
| `BriefcaseManager.downloadBriefcase`     | [RequestNewBriefcaseArg]($backend)                    |                                  |
| `IModelDb.importSchemas`                 | `LocalFileName[]`                                     | `requestContext` removed         |

## `Tool.run` and `Tool.parseAndRun` are now async

In V2.0, the methods [Tool.run]($frontend) and [Tool.parseAndRun]($frontend) were synchronous. This was problematic in that it was impossible to invoke a tool and await its completion. Those two methods are now both `async` and return `Promise<boolean>`. This is obviously a breaking change. Any Tool subclasses that override those methods will need to become async, and any code that calls `Tool.run` or `Tool.parseAndRun` will need to appropriately handle the returned Promise (usually by awaiting it.)

In the process of converting `Tool.run` and `Tool.parseAndRun` to async, several other `Tool` class methods also became async and will likewise need to be modified if they are called or overridden.

These methods were previously synchronous and are now async:

- [Tool.run]($frontend)
- [Tool.parseAndRun]($frontend)
- [InteractiveTool.onInstall]($frontend)
- [InteractiveTool.onPostInstall]($frontend)
- [InteractiveTool.exitTool]($frontend)
- [InteractiveTool.onCleanup]($frontend)
- [InteractiveTool.onSuspend]($frontend)
- [InteractiveTool.onUnsuspend]($frontend)

## `NodeKey` in `@bentley/presentation-common`

The [NodeKey]($presentation-common) object contains a `pathFromRoot` attribute which can be used to uniquely identify a node in a hierarchy. In addition, the attribute is stable - the value for the same node is the same even when being created by different backends, which allows it to be persisted and later be used to identify specific nodes.

In `3.0` changes have been made that changed the way this attribute is calculated, which means the same node produced by pre-3.0 and 3.x versions of `imodeljs` will have keys with different `pathFromRoot` value. To help identify the version of `NodeKey` a new `version` attribute has been added, with `undefined` or `1` being assigned to keys produced by pre-3.0 and `2` being assigned to keys produced by `3.x` versions of imodeljs. In addition, a new [NodeKey.equals]($presentation-common) function has been added to help with the equality checking of node keys, taking their version into account.

## Changes to `Presentation` initialization in `@bentley/presentation-backend`

- [PresentationManagerProps]($presentation-backend) have been restructured to make attributes' purpose clearer. This affects calls to constructor of [PresentationManager]($presentation-backend) and [Presentation.initialize]($presentation-backend). Typical migration:

  **Before:**

  ```ts
  await Presentation.initialize({
    // now `defaultLocale`
    activeLocale: "en-us",

    // now `defaultUnitSystem`
    activeUnitSystem: "metric",

    // now under `caching.hierarchies`
    cacheConfig: { mode: HierarchyCacheMode.Memory },

    // now under `caching.content.size`
    contentCacheSize: 999,

    // removed in favor of `workerThreadsCount`
    taskAllocationsMap: {
        [RequestPriority.Preload]: 1,
        [RequestPriority.Max]: 2,
    },
  });
  ```

  **After:**

  ```ts
  await Presentation.initialize({
    presentation: {
      defaultLocale: "en-us",
      defaultUnitSystem: "metric",
      caching: {
        hierarchies: {
          mode: HierarchyCacheMode.Memory,
        },
        content: {
          size: 999,
        },
      },
      workerThreadsCount: 3,
    },
  });
  ```

## Changes to `Presentation` initialization in `@bentley/presentation-frontend`

- [Presentation.initialize]($presentation-frontend) used to take [PresentationManagerProps]($presentation-frontend) as an argument. Now it takes [PresentationProps]($presentation-frontend) which allows supplying props not only to [PresentationManager]($presentation-frontend), but also [SelectionManager]($presentation-frontend) and [FavoritePropertiesManager]($presentation-frontend). Typical migration:

  **Before:**

  ```ts
  await Presentation.initialize({
    // ...props for presentation manager
    activeLocale: "en-us",
  });
  ```

  **After:**

  ```ts
  await Presentation.initialize({
    presentation: {
      // ...props for presentation manager
      activeLocale: "en-us",
    },
  });
  ```

- The frontend used to by default initialize with an [IFavoritePropertiesStorage]($presentation-frontend) implementation that uses Bentley's user settings service which may not be accessible by third party applications. The behavior was changed to use to a no-op storage by default with ability to choose an implementation that uses the settings service. Typical migration:

  **Before:**

  ```ts
  // no way to override favorite properties storage, so the implementation using settings service is used
  await Presentation.initialize();
  ```

  **After:**

  ```ts
  await Presentation.initialize({
    favorites: {
      // by default the no-op storage is used, but we can choose another option (or provide our own implementation)
      storage: createFavoritePropertiesStorage(DefaultFavoritePropertiesStorageTypes.UserSettingsServiceStorage),
    },
  });
  ```

It is no longer necessary to supply a [Viewport]($frontend) when creating a [GraphicBuilder]($frontend). Instead, you can supply to [RenderSystem.createGraphic]($frontend) a [CustomGraphicBuilderOptions]($frontend) containing a function that can compute the level of detail appropriate for the produced [RenderGraphic]($frontend).

## Changed return types

The backend methods [IModelDb.saveFileProperty]($backend) and [IModelDb.deleteFileProperty]($backend) used to return a [DbResult]($bentleyjs-core). They now are `void`, and throw an exception if an error occurred. The error value can be retrieved in the `errorNumber` member of the exception object, if desired.

## Default minimum level of detail for spatial views

[TileAdmin.Props.minimumSpatialTolerance]($frontend) specifies the minimum level of detail to produce for views of spatial models. Previously, the default was `undefined`, indicating no minimum. The default has been changed to 1 millimeter. This means that when zooming in extremely closely, geometry that contains details on the order of 1mm or smaller will not refine further. This prevents the display system from requesting extraordinarily detailed graphics, improving performance.

To change the minimum, supply a different value at startup. For example, the following code sets the minimum to 1 centimeter:
```ts
await IModelApp.startup({
  tileAdmin: { minimumSpatialTolerance: 0.01 },
});
```

## Signature change to backend Geocoordinate methods

The two methods [IModelDb.getIModelCoordinatesFromGeoCoordinates]($backend) and [IModelDb.getGeoCoordinatesFromIModelCoordinates]($backend) used to take a string argument that was a stringified [IModelCoordinatesRequestProps]($common) and [GeoCoordinatesRequestProps]($common) respectively. Those arguments were changed to accept the interfaces directly. You should remove `JSON.stringify` from your code if you get compile errors.

## Removal of previously deprecated APIs

In this 3.0 major release, we have removed several APIs that were previously marked as deprecated in 2.x. Generally, the reason for the deprecation as well as the alternative suggestions can be found in the 2.x release notes. They are summarized here for quick reference.

### @bentley/imodeljs-backend

| Removed                                                      | Replacement                                    |
| ------------------------------------------------------------ | ---------------------------------------------- |
| `AutoPush`                                                   | *eliminated*                                   |
| `BriefcaseDb.reinstateChanges`                               | `BriefcaseDb.pullChanges`                      |
| `BriefcaseDb.reverseChanges`                                 | `BriefcaseDb.pullChanges`                      |
| `BriefcaseIdValue`                                           | `BriefcaseIdValue` in @bentley/imodeljs-common |
| `BriefcaseManager.getCompatibilityFileName`                  | *eliminated*                                   |
| `BriefcaseManager.getCompatibilityPath`                      | *eliminated*                                   |
| `BriefcaseManager.isStandaloneBriefcaseId`                   | use `id === BriefcaseIdValue.Unassigned`       |
| `compatibilityDir` argument of `BriefcaseManager.initialize` | *eliminated*                                   |
| `DocumentCarrier`                                            | *eliminated*                                   |
| `IModelDb.clearSqliteStatementCache`                         | `IModelDb.clearCaches`                         |
| `IModelDb.clearStatementCache`                               | `IModelDb.clearCaches`                         |
| `IModelHost.iModelClient`                                    | `IModelHubBackend.iModelClient`                |
| `IModelHostConfiguration.briefcaseCacheDir`                  | `IModelHostConfiguration.cacheDir`             |
| `InformationCarrierElement`                                  | *eliminated*                                   |
| `Platform.isDesktop`                                         | `ProcessDetector.isElectronAppBackend`         |
| `Platform.isElectron`                                        | `ProcessDetector.isElectronAppBackend`         |
| `Platform.isMobile`                                          | `ProcessDetector.isMobileAppBackend`           |
| `Platform.isNodeJs`                                          | `ProcessDetector.isNodeProcess`                |
| `SnapshotDb.filePath`                                        | `SnapshotDb.pathName`                          |
| `StandaloneDb.filePath`                                      | `StandaloneDb.pathName`                        |
| `Texture.width, height, flags`                               | *eliminated*                                   |
| `TxnAction`                                                  | `TxnAction` in @bentley/imodeljs-common        |
| `TxnChangedEntities.inserted, deleted, updated`              | `TxnChangedEntities.inserts, deletes, updates` |

### @bentley/imodeljs-common

| Removed                                      | Replacement                                                    |
| -------------------------------------------- | -------------------------------------------------------------- |
| `BriefcaseTypes.DeprecatedStandalone`        | `BriefcaseTypes.Unassigned`                                    |
| `BriefcaseTypes.Standalone`                  | `BriefcaseTypes.Unassigned`                                    |
| `Code.getValue`                              | `Code.value`                                                   |
| `CodeSpec.specScopeType`                     | `CodeSpec.scopeType`                                           |
| `DisplayStyleSettings.excludedElements`      | `DisplayStyleSettings.excludedElementIds`                      |
| `IModel.changeSetId`                         | `IModel.changeset.id`                                          |
| `IModelVersion.evaluateChangeSet`            | `IModelHost`/`IModelApp` `hubAccess.getChangesetIdFromVersion` |
| `IModelVersion.fromJson`                     | `IModelVersion.fromJSON`                                       |
| `IModelVersion.getChangeSetFromNamedVersion` | `IModelHost`/`IModelApp` `hubAccess.getChangesetIdFromVersion` |
| `IModelVersion.getLatestChangeSetId`         | `IModelHost`/`IModelApp` `hubAccess.getChangesetIdFromVersion` |
| `IModelWriteRpcInterface`                    | Use IPC for writing to iModels                                 |
| `LatAndLong`                                 | *eliminated*                                                   |
| `LatLongAndHeight`                           | [CartographicProps]($common)                                   |
| `TerrainSettings.locatable`                  | `BackgroundMapSettings.locatable`                              |
| `TerrainSettingsProps.nonLocatable`          | `BackgroundMapProps.nonLocatable`                              |
| `ViewFlagOverrides` class                    | [ViewFlagOverrides]($common) type                              |
| `ViewFlagProps.edgeMask`                     | *eliminated*                                                   |
| `ViewFlagProps.hlMatColors`                  | *eliminated*                                                   |
| `ViewFlags.clone`                            | [ViewFlags.copy]($common)                                      |
| `ViewFlags.edgeMask`                         | *eliminated*                                                   |
| `ViewFlags.hLineMaterialColors`              | *eliminated*                                                   |
| `ViewFlags.noCameraLights`                   | [ViewFlags.lighting]($common)                                  |
| `ViewFlags.noGeometryMap`                    | *eliminated*                                                   |
| `ViewFlags.noSolarLight`                     | [ViewFlags.lighting]($common)                                  |
| `ViewFlags.noSourceLights`                   | [ViewFlags.lighting]($common)                                  |

### @bentley/imodeljs-frontend

| Removed                                       | Replacement                                                        |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `AppearanceOverrideProps`                     | [AppearanceOverrideProps]($common)                                 |
| `AsyncMethodsOf`                              | [AsyncMethodsOf]($bentleyjs-core)                                  |
| `AsyncFunction`                               | [AsyncFunction]($bentleyjs-core)                                   |
| `EmphasizeElementsProps`                      | [EmphasizeElementsProps]($common)                                  |
| `PromiseReturnType`                           | [PromiseReturnType]($bentleyjs-core)                               |
| `CheckpointConnection.open`                   | `CheckpointConnection.openRemote`                                  |
| `DecorateContext.screenViewport`              | `DecorateContext.viewport`                                         |
| `FeatureOverrideType`                         | [FeatureOverrideType]($common)                                     |
| `FeatureSymbology.Appearance`                 | [FeatureAppearance]($common)                                       |
| `FeatureSymbology.AppearanceProps`            | [FeatureAppearanceProps]($common)                                  |
| `findAvailableRealityModels`                  | `queryRealityData`                                                 |
| `findAvailableUnattachedRealityModels`        | `queryRealityData`                                                 |
| `IModelApp.iModelClient`                      | `IModelHubFrontend.iModelClient`                                   |
| `IModelConnection.Models.loaded`              | use `for..of` to iterate and `getLoaded` to look up by Id          |
| `IModelConnection.Views.saveThumbnail`        | use IPC and `IModelDb.saveThumbnail`                               |
| `IOidcFrontendClient`                         | `FrontendAuthorizationClient`                                      |
| `isIOidcFrontendClient`                       | `FrontendAuthorizationClient`                                      |
| `OidcBrowserClient`                           | `BrowserAuthorizationClient`                                       |
| `OidcFrontendClientConfiguration`             | `BrowserAuthorizationClientConfiguration`                          |
| `QuantityFormatter.onActiveUnitSystemChanged` | [QuantityFormatter.onActiveFormattingUnitSystemChanged]($frontend) |
| `QuantityFormatter.useImperialFormats`        | [QuantityFormatter.setActiveUnitSystem]($frontend)                 |
| `RemoteBriefcaseConnection`                   | `CheckpointConnection`                                             |
| `ScreenViewport.decorationDiv`                | `DecorateContext.addHtmlDecoration`                                |
| `UnitSystemKey`                               | Moved to `@bentley/imodeljs-quantity`                              |
| `ViewManager.forEachViewport`                 | Use a `for..of` loop                                               |
| `ViewState3d.lookAtPerspectiveOrOrtho`        | `ViewState3d.LookAt`                                               |
| `ViewState3d.lookAtUsingLensAngle`            | `ViewState3d.lookAt`                                               |
| `Viewport.featureOverrideProvider`            | [Viewport.featureOverrideProviders]($frontend)                     |
| `Viewport.setFlashed`                         | [Viewport.flashedId]($frontend)                                    |
| `Viewport.setRedrawPending`                   | [Viewport.requestRedraw]($frontend)                                |

### @bentley/geometry-core

| Removed                                         | Replacement                                                |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `BSplineCurve3dBase.createThroughPoints`        | `BSplineCurve3dBase.createFromInterpolationCurve3dOptions` |
| `TransitionSpiralProps.curveLength`             | `TransitionSpiralProps.length`                             |
| `TransitionSpiralProps.fractionInterval`        | `TransitionSpiralProps.activeFractionInterval`             |
| `TransitionSpiralProps.intervalFractions`       | `TransitionSpiralProps.activeFractionInterval`             |
| `InterpolationCurve3dOptions.isChordLenTangent` | `InterpolationCurve3dOptions.isChordLenTangents`           |
| `Point3dArray.createRange`                      | `Range3d.createFromVariantData`                            |

### @bentley/backend-itwin-client

SAML support has officially been dropped as a supported workflow. All related APIs for SAML have been removed.

| Removed                             | Replacement                                  |
| ----------------------------------- | -------------------------------------------- |
| `OidcDelegationClientConfiguration` | `DelegationAuthorizationClientConfiguration` |
| `OidcDelegationClient`              | `DelegationAuthorizationClient`              |

### @bentley/ui-abstract

| Removed                             | Replacement                                  |
| ----------------------------------- | -------------------------------------------- |
| `ContentLayoutProps.priority`       | *eliminated*                                 |

### @bentley/ui-core

| Removed                              | Replacement                                            |
| ------------------------------------ | ------------------------------------------------------ |
| `LoadingPromptProps.isDeterministic` | `LoadingPromptProps.isDeterminate` in @bentley/ui-core |
| `NumericInput` component             | `NumberInput` component in @bentley/ui-core            |
| `TabsProps.onClickLabel`             | `TabsProps.onActivateTab` in @bentley/ui-core          |

### @bentley/ui-components

| Removed                                                    | Replacement                                                                                                                   |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `hasFlag`                                                  | `hasSelectionModeFlag` in @bentley/ui-components                                                                              |
| `StandardEditorNames`                                      | `StandardEditorNames` in @bentley/ui-abstract                                                                                 |
| `StandardTypeConverterTypeNames`                           | `StandardTypeNames` in @bentley/ui-abstract                                                                                   |
| `StandardTypeNames`                                        | `StandardTypeNames` in @bentley/ui-abstract                                                                                   |
| `Timeline`                                                 | `TimelineComponent` in @bentley/ui-components                                                                                 |
| `ControlledTreeProps.treeEvents`                           | `ControlledTreeProps.eventsHandler`                                                                                           |
| `ControlledTreeProps.visibleNodes`                         | `ControlledTreeProps.model`                                                                                                   |
| `MutableTreeModel.computeVisibleNodes`                     | `computeVisibleNodes` in @bentley/ui-components                                                                               |
| `TreeModelSource.getVisibleNodes`                          | memoized result of `computeVisibleNodes`                                                                                      |
| `useVisibleTreeNodes`                                      | `useTreeModel` and `computeVisibleNodes`                                                                                      |
| `SignIn`                                                   | *eliminated*                                                                                                                  |
| All drag & drop related APIs                               | Third party components. E.g. see this [example](https://www.itwinjs.org/sample-showcase/?group=UI+Trees&sample=drag-and-drop) |
| `DEPRECATED_Tree`, `BeInspireTree` and related APIs        | `ControlledTree`                                                                                                              |
| `PropertyValueRendererContext.decoratedTextElement`        | `IPropertyValueRenderer` that can properly render a `PropertyRecord`                                                          |
| `CommonPropertyGridProps.onPropertyLinkClick`              | `PropertyRecord.links.onClick`                                                                                                |
| `onPropertyLinkClick` prop in `usePropertyData`            | `PropertyRecord.links.onClick`                                                                                                |
| `onPropertyLinkClick` prop in `usePropertyGridModelSource` | `PropertyRecord.links.onClick`                                                                                                |
| `FilteringInputProps.filteringInProgress`                  | `FilteringInputProps.status`                                                                                                  |
| `hasLinks`                                                 | `!!PropertyRecord.links?.length`                                                                                              |
| `PropertyListProps.onListWidthChanged`                     | Width is now passed to `PropertyList` through `PropertyListProps.width` prop                                                  |

### @bentley/ui-framework

| Removed                                   | Replacement                                                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `COLOR_THEME_DEFAULT`                     | `SYSTEM_PREFERRED_COLOR_THEME` in @bentley/ui-framework is used as default color theme                                        |
| `FunctionKey`                             | `FunctionKey` in @bentley/ui-abstract                                                                                         |
| `IModelAppUiSettings`                     | `UserSettingsStorage` in @bentley/ui-framework
| `ConfigurableUiManager.findFrontstageDef` | `FrontstageManager.findFrontstageDef`
| `ConfigurableUiManager.loadContentGroup`  | *eliminated*
| `ConfigurableUiManager.loadContentGroups` | *eliminated*
| `ConfigurableUiManager.loadContentLayout` | *eliminated*
| `ConfigurableUiManager.loadContentLayouts`| *eliminated*
| `ContentGroupManager`                     | *eliminated*
| `Frontstage.initializeFrontstageDef`      | `FrontstageManager.getFrontstageDef` (async method)
| `Frontstage.findFrontstageDef`            | `FrontstageManager.getFrontstageDef` (async method)
| `Frontstage.initializeFromProvider`       | `Frontstage.create` (async method)
| `FrontstageProps.defaultLayout`           | `ContentGroup` now holds the layout information.
| `FrontstageProvider.initializeDef`        | *eliminated*
| `FrontstageProvider.frontstageDef`        | `FrontstageManager.getFrontstageDef` (async method)
| `reactElement` in ContentControl          | `ContentControl.reactNode`                                                                                                    |
| `reactElement` in NavigationAidControl    | `NavigationAidControl.reactNode`                                                                                              |
| `reactElement` in NavigationWidgetDef     | `NavigationWidgetDef.reactNode`                                                                                               |
| `reactElement` in ToolWidgetDef           | `ToolWidgetDef.reactNode`                                                                                                     |
| `reactElement` in WidgetControl           | `WidgetControl.reactNode`                                                                                                     |
| `reactElement` in WidgetDef               | `WidgetDef.reactNode`                                                                                                         |
| `ReactMessage`                            | `ReactMessage` in @bentley/ui-core                                                                                            |
| `SpecialKey`                              | `SpecialKey` in @bentley/ui-abstract                                                                                          |
| `WidgetState`                             | `WidgetState` in @bentley/ui-abstract                                                                                         |
| `UserProfileBackstageItem`                | *eliminated*                                                                                                                  |
| `SignIn`                                  | *eliminated*                                                                                                                  |
| `SignOutModalFrontstage`                  | *eliminated*                                                                                                                  |
| `IModelConnectedCategoryTree`             | *eliminated*                                                                                                                  |
| `IModelConnectedModelsTree`               | *eliminated*                                                                                                                  |
| `IModelConnectedSpatialContainmentTree`   | *eliminated*                                                                                                                  |
| `CategoryTreeWithSearchBox`               | *eliminated*                                                                                                                  |
| `VisibilityComponent`                     | `TreeWidgetComponent` in @bentley/tree-widget-react                                                                           |
| `VisibilityWidget`                        | `TreeWidgetControl` in @bentley/tree-widget-react
| `ContentLayoutProps`                      | `ContentLayoutProps` in @bentley/ui-abstract                                                                               |
| All drag & drop related APIs              | Third party components. E.g. see this [example](https://www.itwinjs.org/sample-showcase/?group=UI+Trees&sample=drag-and-drop) |

### @bentley/bentleyjs-core

| Removed         | Replacement                                                |
| --------------- | ---------------------------------------------------------- |
| `Config`        | Use `process.env` to access environment variables directly |
| `EnvMacroSubst` | *eliminated*                                               |

### @bentley/presentation-common

| Removed                                                           | Replacement                                                                                                                                                    |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CompressedDescriptorJSON`                                        | `DescriptorJSON`                                                                                                                                               |
| `ContentInstancesOfSpecificClassesSpecification.arePolymorphic`   | `ContentInstancesOfSpecificClassesSpecification.handleInstancesPolymorphically`                                                                                |
| `ContentModifiersList.propertiesDisplay`                          | `ContentModifiersList.propertyOverrides`                                                                                                                       |
| `ContentModifiersList.propertyEditors`                            | `ContentModifiersList.propertyOverrides`                                                                                                                       |
| `ContentRelatedInstancesSpecification.isRecursive`                | *eliminated*                                                                                                                                                   |
| `ContentRelatedInstancesSpecification.relatedClasses`             | `ContentRelatedInstancesSpecification.relationshipPaths.targetClass`                                                                                           |
| `ContentRelatedInstancesSpecification.relationships`              | `ContentRelatedInstancesSpecification.relationshipPaths.relationship`                                                                                          |
| `ContentRelatedInstancesSpecification.requiredDirection`          | `ContentRelatedInstancesSpecification.relationshipPaths.direction`                                                                                             |
| `ContentRelatedInstancesSpecification.skipRelatedLevel`           | *eliminated*                                                                                                                                                   |
| `Descriptor.toCompressedJSON`                                     | `Descriptor.toJSON`                                                                                                                                            |
| `DescriptorOverrides.hiddenFieldNames`                            | `DescriptorOverrides.fieldsSelector`                                                                                                                           |
| `DescriptorOverrides.sortDirection`                               | `DescriptorOverrides.sorting.direction`                                                                                                                        |
| `DescriptorOverrides.sortingFieldName`                            | `DescriptorOverrides.sorting.field`                                                                                                                            |
| `ECPropertyGroupingNodeKey.groupingValue`                         | `ECPropertyGroupingNodeKey.groupingValues`                                                                                                                     |
| `ExtendedContentRequestOptions`                                   | `ContentRequestOptions`                                                                                                                                        |
| `ExtendedContentRpcRequestOptions`                                | `ContentRpcRequestOptions`                                                                                                                                     |
| `ExtendedHierarchyRequestOptions`                                 | `HierarchyRequestOptions`                                                                                                                                      |
| `ExtendedHierarchyRpcRequestOptions`                              | `HierarchyRpcRequestOptions`                                                                                                                                   |
| `Field.fromJSON`                                                  | `Field.fromCompressedJSON`                                                                                                                                     |
| `HierarchyCompareRpcOptions`                                      | *eliminated*                                                                                                                                                   |
| `LabelRequestOptions`                                             | `DisplayLabelRequestOptions`                                                                                                                                   |
| `LabelRpcRequestOptions`                                          | `DisplayLabelRpcRequestOptions`                                                                                                                                |
| `LoggingNamespaces`                                               | `PresentationBackendLoggerCategory`, `PresentationBackendNativeLoggerCategory`, `PresentationFrontendLoggerCategory` or `PresentationComponentsLoggerCategory` |
| `NodeDeletionInfo.target`                                         | `NodeDeletionInfo.parent` and `NodeDeletionInfo.position`                                                                                                      |
| `NodeDeletionInfoJSON.target`                                     | `NodeDeletionInfoJSON.parent` and `NodeDeletionInfoJSON.position`                                                                                              |
| `PresentationDataCompareOptions`                                  | *eliminated*                                                                                                                                                   |
| `PresentationRpcInterface.compareHierarchies`                     | *eliminated*                                                                                                                                                   |
| `PresentationRpcInterface.compareHierarchiesPaged`                | *eliminated*                                                                                                                                                   |
| `PresentationRpcInterface.getContent`                             | `PresentationRpcInterface.getPagedContent` and `getPagedContentSet`                                                                                            |
| `PresentationRpcInterface.getContentAndSize`                      | `PresentationRpcInterface.getPagedContent` and `getPagedContentSet`                                                                                            |
| `PresentationRpcInterface.getDisplayLabelDefinitions`             | `PresentationRpcInterface.getPagedDisplayLabelDefinitions`                                                                                                     |
| `PresentationRpcInterface.getDistinctValues`                      | `PresentationRpcInterface.getPagedDistinctValues`                                                                                                              |
| `PresentationRpcInterface.getNodes`                               | `PresentationRpcInterface.getPagedNodes`                                                                                                                       |
| `PresentationRpcInterface.getNodesAndCount`                       | `PresentationRpcInterface.getPagedNodes`                                                                                                                       |
| `PresentationRpcInterface.loadHierarchy`                          | *eliminated*                                                                                                                                                   |
| `PresentationUnitSystem`                                          | `UnitSystemKey` in `@bentley/imodeljs-quantity`                                                                                                                |
| `PropertiesFieldDescriptor.propertyClass`                         | `PropertiesFieldDescriptor.properties.class`                                                                                                                   |
| `PropertiesFieldDescriptor.propertyName`                          | `PropertiesFieldDescriptor.properties.name`                                                                                                                    |
| `Property.relatedClassPath`                                       | `NestedContentField.pathToPrimaryClass`                                                                                                                        |
| `PropertyJSON.relatedClassPath`                                   | `NestedContentFieldJSON.pathToPrimaryClass`                                                                                                                    |
| `RelatedInstanceNodesSpecification.relatedClasses`                | `RelatedInstanceNodesSpecification.relationshipPaths.targetClass`                                                                                              |
| `RelatedInstanceNodesSpecification.relationships`                 | `RelatedInstanceNodesSpecification.relationshipPaths.relationship`                                                                                             |
| `RelatedInstanceNodesSpecification.requiredDirection`             | `RelatedInstanceNodesSpecification.relationshipPaths.direction`                                                                                                |
| `RelatedInstanceNodesSpecification.skipRelatedLevel`              | *eliminated*                                                                                                                                                   |
| `RelatedInstanceNodesSpecification.supportedSchemas`              | *eliminated*                                                                                                                                                   |
| `RelatedInstanceSpecification.class`                              | `RelatedInstanceSpecification.relationshipPath.targetClass`                                                                                                    |
| `RelatedInstanceSpecification.relationship`                       | `RelatedInstanceSpecification.relationshipPath.relationship`                                                                                                   |
| `RelatedInstanceSpecification.requiredDirection`                  | `RelatedInstanceSpecification.relationshipPath.direction`                                                                                                      |
| `RelatedPropertiesSpecification.isPolymorphic`                    | `RelatedPropertiesSpecification.handleTargetClassPolymorphically`                                                                                              |
| `RelatedPropertiesSpecification.propertyNames`                    | `RelatedPropertiesSpecification.properties`                                                                                                                    |
| `RelatedPropertiesSpecification.relatedClasses`                   | `RelatedPropertiesSpecification.propertiesSource.targetClass`                                                                                                  |
| `RelatedPropertiesSpecification.relationships`                    | `RelatedPropertiesSpecification.propertiesSource.relationship`                                                                                                 |
| `RelatedPropertiesSpecification.requiredDirection`                | `RelatedPropertiesSpecification.propertiesSource.direction`                                                                                                    |
| `Ruleset.supportedSchemas`                                        | `Ruleset.requiredSchemas`                                                                                                                                      |
| `RequestPriority`                                                 | *eliminated*                                                                                                                                                   |
| `RequestOptions<TIModel>.priority`                                | *eliminated*                                                                                                                                                   |
| `SelectClassInfo.pathToPrimaryClass`                              | `SelectClassInfo.pathFromInputToSelectClass`                                                                                                                   |
| `SelectClassInfo.relatedInstanceClasses`                          | `SelectClassInfo.relatedInstancePaths`                                                                                                                         |
| `SelectClassInfoJSON.pathToPrimaryClass`                          | `SelectClassInfoJSON.pathFromInputToSelectClass`                                                                                                               |
| `SelectClassInfoJSON.relatedInstanceClasses`                      | `SelectClassInfoJSON.relatedInstancePaths`                                                                                                                     |

### @bentley/presentation-backend

| Removed                                       | Replacement                                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `DuplicateRulesetHandlingStrategy`            | `RulesetInsertOptions`                                                                                                    |
| `PresentationManager.activeUnitSystem`        | Changed type from `PresentationUnitSystem` to `UnitSystemKey`                                                             |
| `PresentationManager.getContentAndSize`       | `PresentationManager.getContent` and `getContentSetSize`                                                                  |
| `PresentationManager.getDistinctValues`       | `PresentationManager.getPagedDistinctValues`                                                                              |
| `PresentationManager.getNodesAndCount`        | `PresentationManager.getNodes` and `getNodesCount`                                                                        |
| `PresentationManager.loadHierarchy`           | *eliminated*                                                                                                              |
| `PresentationManagerProps.activeLocale`       | `PresentationManagerProps.defaultLocale`                                                                                  |
| `PresentationManagerProps.activeUnitSystem`   | Renamed to `PresentationManagerProps.defaultUnitSystem` and changed type from `PresentationUnitSystem` to `UnitSystemKey` |
| `PresentationManagerProps.cacheConfig`        | `PresentationManagerProps.caching.hierarchies`                                                                            |
| `PresentationManagerProps.contentCacheSize`   | `PresentationManagerProps.caching.content.size`                                                                           |
| `PresentationManagerProps.taskAllocationsMap` | `PresentationManagerProps.workerThreadsCount`                                                                             |
| `UnitSystemFormat.unitSystems`                | Changed type from `PresentationUnitSystem[]` to `UnitSystemKey[]`                                                         |
| `WithClientRequestContext<T>`                 | *eliminated*                                                                                                              |

### @bentley/presentation-frontend

| Removed                                     | Replacement                                                   |
| ------------------------------------------- | ------------------------------------------------------------- |
| `PresentationManager.activeUnitSystem`      | Changed type from `PresentationUnitSystem` to `UnitSystemKey` |
| `PresentationManager.compareHierarchies`    | *eliminated*                                                  |
| `PresentationManager.getDistinctValues`     | `PresentationManager.getPagedDistinctValues`                  |
| `PresentationManager.loadHierarchy`         | *eliminated*                                                  |
| `PresentationManagerProps.activeUnitSystem` | Changed type from `PresentationUnitSystem` to `UnitSystemKey` |

### @bentley/presentation-components

| Removed                                                | Replacement                                     |
| ------------------------------------------------------ | ----------------------------------------------- |
| `ContentDataProvider.configureContentDescriptor`       | `ContentDataProvider.getDescriptorOverrides`    |
| `ContentDataProvider.isFieldHidden`                    | `ContentDataProvider.getDescriptorOverrides`    |
| `ContentDataProvider.shouldConfigureContentDescriptor` | *eliminated*                                    |
| `ContentDataProvider.shouldExcludeFromDescriptor`      | `ContentDataProvider.getDescriptorOverrides`    |
| `ControlledTreeFilteringProps`                         | `ControlledPresentationTreeFilteringProps`      |
| `DEPRECATED_controlledTreeWithFilteringSupport`        | *eliminated*                                    |
| `DEPRECATED_controlledTreeWithVisibleNodes`            | *eliminated*                                    |
| `DEPRECATED_treeWithFilteringSupport`                  | `useControlledPresentationTreeFiltering`        |
| `DEPRECATED_treeWithUnifiedSelection`                  | `useUnifiedSelectionTreeEventHandler`           |
| `FilteredPresentationTreeDataProvider.loadHierarchy`   | *eliminated*                                    |
| `IPresentationTreeDataProvider.loadHierarchy`          | *eliminated*                                    |
| `PresentationTreeDataProvider.loadHierarchy`           | *eliminated*                                    |
| `PresentationTreeNodeLoaderProps.preloadingEnabled`    | *eliminated*                                    |
| `propertyGridWithUnifiedSelection`                     | `usePropertyDataProviderWithUnifiedSelection`   |
| `PropertyGridWithUnifiedSelectionProps`                | `PropertyDataProviderWithUnifiedSelectionProps` |
| `TreeWithFilteringSupportProps`                        | `ControlledPresentationTreeFilteringProps`      |
| `TreeWithUnifiedSelectionProps`                        | `UnifiedSelectionTreeEventHandlerParams`        |
| `useControlledTreeFiltering`                           | `useControlledPresentationTreeFiltering`        |

### @bentley/ecschema-metadata

| Removed                                  | Replacement                                                  |
| -----------------------------------------| ------------------------------------------------------------ |
| `IDiagnostic`                            | `IDiagnostic` in @bentley/ecschema-editing                   |
| `BaseDiagnostic`                         | `BaseDiagnostic` in @bentley/ecschema-editing                |
| `DiagnosticType`                         | `DiagnosticType` in @bentley/ecschema-editing                |
| `DiagnosticCategory`                     | `DiagnosticCategory` in @bentley/ecschema-editing            |
| `DiagnosticCodes`                        | `DiagnosticCodes` in @bentley/ecschema-editing               |
| `Diagnostics`                            | `Diagnostics` in @bentley/ecschema-editing                   |
| `IDiagnosticReporter`                    | `IDiagnosticReporter` in @bentley/ecschema-editing           |
| `SuppressionDiagnosticReporter`          | `SuppressionDiagnosticReporter` in @bentley/ecschema-editing |
| `FormatDiagnosticReporter`               | `FormatDiagnosticReporter` in @bentley/ecschema-editing      |
| `LoggingDiagnosticReporter`              | `LoggingDiagnosticReporter` in @bentley/ecschema-editing     |
| `IRuleSet`                               | `IRuleSet` in @bentley/ecschema-editing                      |
| `ECRuleSet`                              | `ECRuleSet` in @bentley/ecschema-editing                     |
| `ISuppressionRule`                       | `ISuppressionRule` in @bentley/ecschema-editing              |
| `BaseSuppressionRule`                    | `BaseSuppressionRule` in @bentley/ecschema-editing           |
| `IRuleSuppressionMap`                    | `IRuleSuppressionMap` in @bentley/ecschema-editing           |
| `BaseRuleSuppressionMap`                 | `BaseRuleSuppressionMap` in @bentley/ecschema-editing        |
| `IRuleSuppressionSet`                    | `IRuleSuppressionSet` in @bentley/ecschema-editing           |
| `SchemaCompareCodes`                     | `SchemaCompareCodes` in @bentley/ecschema-editing            |
| `SchemaCompareDiagnostics`               | `SchemaCompareDiagnostics` in @bentley/ecschema-editing      |
| `SchemaValidater`                        | `SchemaValidater` in @bentley/ecschema-editing               |
| `SchemaValidationVisitor`                | `SchemaValidationVisitor` in @bentley/ecschema-editing       |
| `RelationshipConstraint.deserialize`     | `RelationshipConstraint.fromJSON`                   |
| `RelationshipConstraint.deserializeSync` | `RelationshipConstraint.fromJSONSync`               |
| `RelationshipConstraint.toJson`          | `RelationshipConstraint.toJSON`                     |

<!---
User Interface Changes - section to comment below
-->

## User Interface Changes

Several changes were made in the @bentley/ui-* packages.
Some components in @bentley/ui-core were deprecated in favor of components in @itwinui-react.
A few constructs were deprecated in @bentley/ui-core package with alternatives elsewhere.
A new @bentley/ui-imodel-components package has been added and contains items related to Color, Cube, LineWeight, Navigation Aids, Quantity Inputs, Timeline and Viewport.

The @bentley/ui-* and @bentley/presentation-components packages are now dependent on React version 17. **Applications using the ui packages must update to React 17.** Details about React version 17 can be found in the [React Blog](https://reactjs.org/blog/2020/10/20/react-v17.html).

For migration purposes, React 16 is included in the peerDependencies for the packages. React 16 is not an officially supported version of iTwin.js app or Extension development using the iTwin.js AppUi.

### New options for defining Frontstages

| Class/Component                                        | Description                                                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------|
| [StandardFrontstageProvider]($ui-framework)            | Frontstage provider that provides an 'empty' stage that is to be populated via UiItemsProviders.   |
| [StandardContentToolsProvider]($ui-framework)          | UiItemsProvider that will add common tool entries to Tool Widget.                                  |
| [StandardNavigationToolsProvider]($ui-framework)       | UiItemsProvider that will add common view tool entries to Navigation Widget.                       |
| [StandardStatusbarItemsProvider]($ui-framework)        | UiItemsProvider that will add common statusbar items.                                              |
| [ContentToolWidgetComposer]($ui-framework)             | Provides an empty Tool Widget that is to be populate via UiItemsProviders.                         |
| [ViewToolWidgetComposer]($ui-framework)                | Provides an empty Navigation Widget that is to be populate via UiItemsProviders.                   |
| [StandardContentLayouts]($ui-abstract)                 | Provides standard view layouts that can be used when defining a ContentGroup.                      |
| [ContentGroupProvider]($ui-framework)                  | Class that generates a ContentGroup at runtime when the frontstageDef is being constructed.        |

### New Timeline Date Marker

The [TimelineComponent]($ui-imodel-components) react component now accepts a property to mark a specific date in a date-based timeline. If the timeline has a defined start date and end date, a date between them can be marked in the timeline by specifying an instance of [TimelineDateMarkerProps]($ui-imodel-components) in the new markDate member of [TimelineComponentProps]($ui-imodel-components). If the date member is left undefined, today's date will be used. The default marker is a short vertical bar, but a ReactNode can be specified in the dateMarker prop to customize the marker's appearance.

### New Floating Widget Capabilities

Widgets provided via UiItemsProviders may now set `defaultState: WidgetState.Floating` and `isFloatingStateSupported: true` to open
the widget in a floating container. The property `defaultFloatingPosition` may also be specified to define the position of the floating container. If a position is not defined the container will be centered in the `AppUi` area.

The method `getFloatingWidgetContainerIds()` has been added to FrontstageDef to retrieve the Ids for all floating widget containers for the active frontstage as specified by the `frontstageDef`. These ids can be used to query the size of the floating container via `frontstageDef.getFloatingWidgetContainerBounds`. The method `frontstageDef.setFloatingWidgetContainerBounds` can then be used to set the size and position of a floating widget container.

### `ControlledTree` API Changes

`ControlledTree` component has received the following breaking changes:

- The component now takes `TreeModel` rather than `VisibleTreeNodes` as a prop to avoid requiring consumers to manage `VisibleTreeNodes` object. As a result, the `useVisibleTreeNodes` hook was replaced with `useTreeModel` hook. Typical migration:

  **Before:**

  ```tsx
  const visibleNodes = useVisibleTreeNodes(modelSource);
  return <ControlledTree visibleNodes={visibleNodes} {...otherProps} />;
  ```

  **After:**

  ```tsx
  const treeModel = useTreeModel(modelSource);
  return <ControlledTree model={treeModel} {...otherProps} />;
  ```

- Name of the `treeEvents` prop was changed to `eventsHandler` to make it clearer. Typical migration:

  **Before:**

  ```tsx
  return <ControlledTree treeEvents={eventsHandler} {...otherProps} />;
  ```

  **After:**

  ```tsx
  return <ControlledTree eventsHandler={eventsHandler} {...otherProps} />;
  ```

- `width` and `height` properties are now required. Previously they were optional and forced us to use non-optimal approach when not provided. Now it's up to the consumer to tell the size of the component. Typical migration:

  **Before:**

  ```tsx
  return <ControlledTree {...props} />;
  ```

  **After:**

  ```tsx
  const width = 100;
  const height = 100;
  return <ControlledTree width={width} height={height} {...props} />;
  ```

  `width` and `height` props may be calculated dynamically using [ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver) API.

### PropertyGrid - related API Changes

- `width` and `height` are now required props for `VirtualizedPropertyGrid` and `VirtualizedPropertyGridWithDataProvider`. Also, `width` is now a required property for `PropertyList`. Previously they were optional and forced us to use non-optimal approach when not provided. Now it's up to the consumer to tell the size of the component. Typical migration:

  **Before:**

  ```tsx
  return <VirtualizedPropertyGrid {...props} />;
  ```

  **After:**

  ```tsx
  const width = 100;
  const height = 100;
  return <VirtualizedPropertyGrid width={width} height={height} {...props} />;
  ```

  `width` and `height` props may be calculated dynamically using [ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver) API.

- Default value of `PresentationPropertyDataProvider.isNestedPropertyCategoryGroupingEnabled` was changed from `false` to `true`.

### Deprecated Components in Favor of iTwinUI-react Components

Several UI components in the @bentley/ui-core and @bentley/ui-components packages have been deprecated.
Developers should use equivalent components in @itwin/itwinui-react instead.

| Deprecated in @bentley/ui-core | Use from @itwin/itwinui-react instead          |
| ------------------------------ | ---------------------------------------------- |
| Button                         | Button                                         |
| ButtonSize                     | `size` prop for itwinui-react Button           |
| ButtonType                     | `styleType` prop for itwinui-react Button      |
| Checkbox                       | Checkbox                                       |
| ExpandableBlock                | ExpandableBlock                                |
| Headline                       | Headline                                       |
| HorizontalTabs                 | HorizontalTabs                                 |
| Input                          | Input                                          |
| LabeledInput                   | LabeledInput                                   |
| LabeledSelect                  | LabeledSelect                                  |
| LabeledTextarea                | LabeledTextarea                                |
| LabeledToggle                  | ToggleSwitch with `labelPosition="right"` prop |
| LeadingText                    | Leading                                        |
| ProgressBar                    | ProgressLinear                                 |
| ProgressSpinner                | ProgressRadial                                 |
| Radio                          | Radio                                          |
| Select                         | Select                                         |
| SelectOption                   | SelectOption                                   |
| Slider                         | Slider                                         |
| SmallText                      | Small                                          |
| Spinner                        | ProgressRadial with `indeterminate` prop       |
| SpinnerSize                    | `size` prop in ProgressRadialProps             |
| SplitButton                    | SplitButton                                    |
| Subheading                     | Subheading                                     |
| Textarea                       | Textarea                                       |
| Tile                           | Tile                                           |
| Title                          | Title                                          |
| Toggle                         | ToggleSwitch                                   |
| Tooltip                        | Tooltip                                        |
| TooltipPlacement               | Placement                                      |

| Deprecated in @bentley/ui-components | Use from @itwin/itwinui-react instead |
| ------------------------------------ | ------------------------------------- |
| Breadcrumb                           | Breadcrumbs                           |

#### Slider

The deprecated [Slider]($ui-core) was a wrapper around the react-compound-slider that does not work properly in popout windows. To eliminate this issue, the deprecated `Slider`will now wrap the  `Slider` component from @itwin/itwinui-react. This result is a couple prop changes. The `onSlideStart` or `onSlideEnd` props are ignored, use `onUpdate` and `onChange` props if needed. The only two `modes` that remain supported are 1 and 2.

### Deprecated with alternatives elsewhere

A few constructs were deprecated in @bentley/ui-core package.
Some were copied to the @bentley/ui-abstract package.
Some have replacements within the @bentley/ui-core package.

| Deprecated                            | Replacement                                |
| ------------------------------------- | ------------------------------------------ |
| DialogButtonDef in @bentley/ui-core   | DialogButtonDef in @bentley/ui-abstract    |
| DialogButtonStyle in @bentley/ui-core | DialogButtonStyle in @bentley/ui-abstract  |
| DialogButtonType in @bentley/ui-core  | DialogButtonType in @bentley/ui-abstract   |
| LocalUiSettings in @bentley/ui-core   | LocalSettingsStorage in @bentley/ui-core   |
| SessionUiSettings in @bentley/ui-core | SessionSettingsStorage in @bentley/ui-core |

### New @bentley/ui-imodel-components package

A new @bentley/ui-imodel-components package has been added, and some items were moved from @bentley/ui-core and @bentley/ui-components into this new package.
The ui-imodel-components package contains React components that depend on the imodeljs-frontend, imodeljs-common or imodeljs-quantity packages.
Dependencies on these other iTwin.js packages have been removed from ui-core and ui-components.
The items moved to ui-imodel-components are related to Color, Cube, LineWeight, Navigation Aids, Quantity Inputs, Timeline and Viewport.

The following items were moved into the ui-imodel-components package. For a complete list, see [iTwin.js Documentation](https://www.itwinjs.org/reference/ui-imodel-components/all).

- ColorPickerButton, ColorPickerDialog, ColorPickerPopup, ColorPropertyEditor, ColorSwatch
- Cube, CubeNavigationAid, CubeRotationChangeEventArgs
- DrawingNavigationAid
- QuantityInput, QuantityNumberInput
- TimelineComponent, TimelineDataProvider, TimelineMenuItemProps
- ViewportComponent, ViewportComponentEvents
- LineWeightSwatch, WeightPickerButton, WeightPropertyEditor

### Tasks and Workflows Deprecated

Classes and methods pertaining to Tasks and Workflows have been deprecated due to a change in the UX design.
Please continue to use Frontstages.

<!---
User Interface Changes - section above this point
-->

## @bentley/extension-cli

The cli tool has been deprecated due to an impending change of Extensions and the Extension Service. Please continue to use the 2.x version if you still require publishing Extensions.

## @bentley/config-loader

The loader has been deprecated due to a preference for using the dotenv package instead. Any workflows using .env files will not be affected.

## @bentley/geometry-core

The method `BSplineCurve3d.createThroughPoints` has been deprecated in favor of the more general method `BSplineCurve3d.createFromInterpolationCurve3dOptions`.

The property `InterpolationCurve3dOptions.isChordLenTangent` has been deprecated due to a naming inconsistency with similar adjacent properties. Use `InterpolationCurve3dOptions.isChordLenTangents` instead.

## new @bentley/imodeljs-transformer package split out of backend package

The iModel Transformer APIs, such as the classes [IModelExporter]($transformer), [IModelImporter]($transformer), and [IModelTransformer]($transformer)
were removed from the `@bentley/imodeljs-backend` package and moved to a new package, `@bentley/imodeljs-transformer`.

## @bentley/imodeljs-common

The `fromRadians`, `fromDegrees`, and `fromAngles` methods of [Cartographic]($common) now expect to receive a single input argument - an object containing a longitude, latitude and optional height property. The public constructor for [Cartographic]($common) has also been removed. If you would like to create a [Cartographic]($common) object without specifying longitude and latiude, you can use the new `createZero` method. These changes will help callers avoid misordering longitude, latitude, and height when creating a [Cartographic]($common) object. Additionally, the `LatAndLong` and `LatLongAndHeight` interfaces have been removed and replaced with a single [CartographicProps]($common) interface.
