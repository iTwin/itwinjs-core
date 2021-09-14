---
publish: false
---
# NextVersion

## Dependency Updates

The following dependencies of iTwin.js have been updated;

- `openid-client` updated to from `^3.15.3` -> `^4.7.4`,

## Build tools changes

Removed TSLint support from `@bentley/build-tools`. If you're still using it, please switch to ESLint.
Also removed legacy `.eslintrc.js` file from the same package. Instead, use `@bentley/eslint-plugin` and the `imodeljs-recommended` config included in it.

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

[ViewState3d.lookAt]($frontend) previously took 6 arguments. In addition the method `ViewState3d.lookAtUsingLensAngle` also established a perspective `ViewState3d` from a field-of-view lens angle with many of the same arguments. There is now a new implementation of `ViewState3d.lookAt` that accepts named parameters to set up either a perspective or orthographic view, using the interfaces [LookAtPerspectiveArgs]($frontend), [LookAtOrthoArgs]($frontend), or [LookAtUsingLensAngle]($frontend).

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

## Removed default Bing Maps and MapBox keys

The `@bentley/imodeljs-frontend` has always been delivered with a Bing Maps and MapBox Imagery key which should have never been publicly exposed. Both keys have now been completely removed and all applications will need to provide their own keys.

In order to configure a key for Bing Maps, or any other map layers, use the [[IModelAppOptions.mapLayerOptions]] configuration to supply the necessary information.

```ts
const appOptions = {
  maplayerOptions: {
    BingMaps: {
      key: "some key",
      value: "key"
    }
  }
}
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
| `TxnAction`                                                  | `TxnAction` in @bentley/imodeljs-common        |

### @bentley/imodeljs-common

| Removed                                      | Replacement                                                    |
| -------------------------------------------- | -------------------------------------------------------------- |
| `Code.getValue`                              | `Code.value`                                                   |
| `CodeSpec.specScopeType`                     | `CodeSpec.scopeType`                                           |
| `IModel.changeSetId`                         | `IModel.changeset.id`                                          |
| `IModelVersion.evaluateChangeSet`            | `IModelHost`/`IModelApp` `hubAccess.getChangesetIdFromVersion` |
| `IModelVersion.fromJson`                     | `IModelVersion.fromJSON`                                       |
| `IModelVersion.getChangeSetFromNamedVersion` | `IModelHost`/`IModelApp` `hubAccess.getChangesetIdFromVersion` |
| `IModelVersion.getLatestChangeSetId`         | `IModelHost`/`IModelApp` `hubAccess.getChangesetIdFromVersion` |
| `IModelWriteRpcInterface`                    | Use IPC for writing to iModels                                 |
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

| Removed                                | Replacement                                               |
| -------------------------------------- | --------------------------------------------------------- |
| `CheckpointConnection.open`            | `CheckpointConnection.openRemote`                         |
| `DecorateContext.screenViewport`       | `DecorateContext.viewport`                                |
| `IModelApp.iModelClient`               | `IModelHubFrontend.iModelClient`                          |
| `IModelConnection.Models.loaded`       | use `for..of` to iterate and `getLoaded` to look up by Id |
| `IModelConnection.Views.saveThumbnail` | use IPC and `IModelDb.saveThumbnail`                      |
| `IOidcFrontendClient`                  | `FrontendAuthorizationClient`                             |
| `isIOidcFrontendClient`                | `FrontendAuthorizationClient`                             |
| `OidcBrowserClient`                    | `BrowserAuthorizationClient`                              |
| `OidcFrontendClientConfiguration`      | `BrowserAuthorizationClientConfiguration`                 |
| `RemoteBriefcaseConnection`            | `CheckpointConnection`                                    |
| `ScreenViewport.decorationDiv`         | `DecorateContext.addHtmlDecoration`                       |
| `UnitSystemKey`                        | Moved to `@bentley/imodeljs-quantity`                     |
| `ViewManager.forEachViewport`          | Use a `for..of` loop                                      |
| `ViewState3d.lookAtPerspectiveOrOrtho` | `ViewState3d.LookAt`                                      |
| `ViewState3d.lookAtUsingLensAngle`     | `ViewState3d.lookAt`                                      |

### @bentley/backend-itwin-client

SAML support has officially been dropped as a supported workflow. All related APIs for SAML have been removed.

| Removed                             | Replacement                                  |
| ----------------------------------- | -------------------------------------------- |
| `OidcDelegationClientConfiguration` | `DelegationAuthorizationClientConfiguration` |
| `OidcDelegationClient`              | `DelegationAuthorizationClient`              |

### @bentley/ui-core

| Removed                              | Replacement                                            |
| ------------------------------------ | ------------------------------------------------------ |
| `LoadingPromptProps.isDeterministic` | `LoadingPromptProps.isDeterminate` in @bentley/ui-core |
| `NumericInput` component             | `NumberInput` component in @bentley/ui-core            |
| `TabsProps.onClickLabel`             | `TabsProps.onActivateTab` in @bentley/ui-core          |

### @bentley/ui-components

| Removed                                | Replacement                                      |
| -------------------------------------- | ------------------------------------------------ |
| `hasFlag`                              | `hasSelectionModeFlag` in @bentley/ui-components |
| `StandardEditorNames`                  | `StandardEditorNames` in @bentley/ui-abstract    |
| `StandardTypeConverterTypeNames`       | `StandardTypeNames` in @bentley/ui-abstract      |
| `StandardTypeNames`                    | `StandardTypeNames` in @bentley/ui-abstract      |
| `Timeline`                             | `TimelineComponent` in @bentley/ui-components    |
| `ControlledTreeProps.treeEvents`       | `ControlledTreeProps.eventsHandler`              |
| `ControlledTreeProps.visibleNodes`     | `ControlledTreeProps.model`                      |
| `MutableTreeModel.computeVisibleNodes` | `computeVisibleNodes` in @bentley/ui-components  |
| `TreeModelSource.getVisibleNodes`      | memoized result of `computeVisibleNodes`         |
| `useVisibleTreeNodes`                  | `useTreeModel` and `computeVisibleNodes`         |
| `SignIn`                               | *eliminated*                                     |

### @bentley/ui-framework

| Removed                                 | Replacement                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| `COLOR_THEME_DEFAULT`                   | `SYSTEM_PREFERRED_COLOR_THEME` in @bentley/ui-framework is used as default color theme |
| `FunctionKey`                           | `FunctionKey` in @bentley/ui-abstract                                                  |
| `IModelAppUiSettings`                   | `UserSettingsStorage` in @bentley/ui-framework                                         |
| `reactElement` in ContentControl        | `ContentControl.reactNode`                                                             |
| `reactElement` in NavigationAidControl  | `NavigationAidControl.reactNode`                                                       |
| `reactElement` in NavigationWidgetDef   | `NavigationWidgetDef.reactNode`                                                        |
| `reactElement` in ToolWidgetDef         | `ToolWidgetDef.reactNode`                                                              |
| `reactElement` in WidgetControl         | `WidgetControl.reactNode`                                                              |
| `reactElement` in WidgetDef             | `WidgetDef.reactNode`                                                                  |
| `ReactMessage`                          | `ReactMessage` in @bentley/ui-core                                                     |
| `SpecialKey`                            | `SpecialKey` in @bentley/ui-abstract                                                   |
| `WidgetState`                           | `WidgetState` in @bentley/ui-abstract                                                  |
| `UserProfileBackstageItem`              | *eliminated*                                                                           |
| `SignIn`                                | *eliminated*                                                                           |
| `SignOutModalFrontstage`                | *eliminated*                                                                           |
| `IModelConnectedCategoryTree`           | *eliminated*                                                                           |
| `IModelConnectedModelsTree`             | *eliminated*                                                                           |
| `IModelConnectedSpatialContainmentTree` | *eliminated*                                                                           |
| `CategoryTreeWithSearchBox`             | *eliminated*                                                                           |
| `VisibilityComponent`                   | `TreeWidgetComponent` in @bentley/tree-widget-react                                    |
| `VisibilityWidget`                      | `TreeWidgetControl` in @bentley/tree-widget-react                                      |

### @bentley/bentleyjs-core

| Removed         | Replacement                                                |
| --------------- | ---------------------------------------------------------- |
| `Config`        | Use `process.env` to access environment variables directly |
| `EnvMacroSubst` | *eliminated*                                               |

### @bentley/presentation-common

| Removed                                               | Replacement                                                                                                                                                    |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CompressedDescriptorJSON`                            | `DescriptorJSON`                                                                                                                                               |
| `Descriptor.toCompressedJSON`                         | `Descriptor.toJSON`                                                                                                                                            |
| `DescriptorOverrides.hiddenFieldNames`                | `DescriptorOverrides.fieldsSelector`                                                                                                                           |
| `DescriptorOverrides.sortDirection`                   | `DescriptorOverrides.sorting.direction`                                                                                                                        |
| `DescriptorOverrides.sortingFieldName`                | `DescriptorOverrides.sorting.field`                                                                                                                            |
| `ECPropertyGroupingNodeKey.groupingValue`             | `ECPropertyGroupingNodeKey.groupingValues`                                                                                                                     |
| `ExtendedContentRequestOptions`                       | `ContentRequestOptions`                                                                                                                                        |
| `ExtendedContentRpcRequestOptions`                    | `ContentRpcRequestOptions`                                                                                                                                     |
| `ExtendedHierarchyRequestOptions`                     | `HierarchyRequestOptions`                                                                                                                                      |
| `ExtendedHierarchyRpcRequestOptions`                  | `HierarchyRpcRequestOptions`                                                                                                                                   |
| `Field.fromJSON`                                      | `Field.fromCompressedJSON`                                                                                                                                     |
| `HierarchyCompareRpcOptions`                          | *eliminated*                                                                                                                                                   |
| `LabelRequestOptions`                                 | `DisplayLabelRequestOptions`                                                                                                                                   |
| `LabelRpcRequestOptions`                              | `DisplayLabelRpcRequestOptions`                                                                                                                                |
| `LoggingNamespaces`                                   | `PresentationBackendLoggerCategory`, `PresentationBackendNativeLoggerCategory`, `PresentationFrontendLoggerCategory` or `PresentationComponentsLoggerCategory` |
| `NodeDeletionInfo.target`                             | `NodeDeletionInfo.parent` and `NodeDeletionInfo.position`                                                                                                      |
| `NodeDeletionInfoJSON.target`                         | `NodeDeletionInfoJSON.parent` and `NodeDeletionInfoJSON.position`                                                                                              |
| `PresentationDataCompareOptions`                      | *eliminated*                                                                                                                                                   |
| `PresentationRpcInterface.compareHierarchies`         | *eliminated*                                                                                                                                                   |
| `PresentationRpcInterface.compareHierarchiesPaged`    | *eliminated*                                                                                                                                                   |
| `PresentationRpcInterface.getContent`                 | `PresentationRpcInterface.getPagedContent` and `getPagedContentSet`                                                                                            |
| `PresentationRpcInterface.getContentAndSize`          | `PresentationRpcInterface.getPagedContent` and `getPagedContentSet`                                                                                            |
| `PresentationRpcInterface.getDisplayLabelDefinitions` | `PresentationRpcInterface.getPagedDisplayLabelDefinitions`                                                                                                     |
| `PresentationRpcInterface.getDistinctValues`          | `PresentationRpcInterface.getPagedDistinctValues`                                                                                                              |
| `PresentationRpcInterface.getNodes`                   | `PresentationRpcInterface.getPagedNodes`                                                                                                                       |
| `PresentationRpcInterface.getNodesAndCount`           | `PresentationRpcInterface.getPagedNodes`                                                                                                                       |
| `PresentationRpcInterface.loadHierarchy`              | *eliminated*                                                                                                                                                   |
| `PresentationUnitSystem`                              | `UnitSystemKey` in `@bentley/imodeljs-quantity`                                                                                                                |
| `PropertiesFieldDescriptor.propertyClass`             | `PropertiesFieldDescriptor.properties.class`                                                                                                                   |
| `PropertiesFieldDescriptor.propertyName`              | `PropertiesFieldDescriptor.properties.name`                                                                                                                    |
| `Property.relatedClassPath`                           | `NestedContentField.pathToPrimaryClass`                                                                                                                        |
| `PropertyJSON.relatedClassPath`                       | `NestedContentFieldJSON.pathToPrimaryClass`                                                                                                                    |
| `SelectClassInfo.pathToPrimaryClass`                  | `SelectClassInfo.pathFromInputToSelectClass`                                                                                                                   |
| `SelectClassInfo.relatedInstanceClasses`              | `SelectClassInfo.relatedInstancePaths`                                                                                                                         |
| `SelectClassInfoJSON.pathToPrimaryClass`              | `SelectClassInfoJSON.pathFromInputToSelectClass`                                                                                                               |
| `SelectClassInfoJSON.relatedInstanceClasses`          | `SelectClassInfoJSON.relatedInstancePaths`                                                                                                                     |

### @bentley/presentation-backend

| Removed                                     | Replacement                                                       |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `DuplicateRulesetHandlingStrategy`          | `RulesetInsertOptions`                                            |
| `PresentationManager.activeUnitSystem`      | Changed type from `PresentationUnitSystem` to `UnitSystemKey`     |
| `PresentationManager.getContentAndSize`     | `PresentationManager.getContent` and `getContentSetSize`          |
| `PresentationManager.getDistinctValues`     | `PresentationManager.getPagedDistinctValues`                      |
| `PresentationManager.getNodesAndCount`      | `PresentationManager.getNodes` and `getNodesCount`                |
| `PresentationManager.loadHierarchy`         | *eliminated*                                                      |
| `PresentationManagerProps.activeUnitSystem` | Changed type from `PresentationUnitSystem` to `UnitSystemKey`     |
| `UnitSystemFormat.unitSystems`              | Changed type from `PresentationUnitSystem[]` to `UnitSystemKey[]` |

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

| Removed                         | Replacement                                                  |
| ------------------------------- | ------------------------------------------------------------ |
| `IDiagnostic`                   | `IDiagnostic` in @bentley/ecschema-editing                   |
| `BaseDiagnostic`                | `BaseDiagnostic` in @bentley/ecschema-editing                |
| `DiagnosticType`                | `DiagnosticType` in @bentley/ecschema-editing                |
| `DiagnosticCategory`            | `DiagnosticCategory` in @bentley/ecschema-editing            |
| `DiagnosticCodes`               | `DiagnosticCodes` in @bentley/ecschema-editing               |
| `Diagnostics`                   | `Diagnostics` in @bentley/ecschema-editing                   |
| `IDiagnosticReporter`           | `IDiagnosticReporter` in @bentley/ecschema-editing           |
| `SuppressionDiagnosticReporter` | `SuppressionDiagnosticReporter` in @bentley/ecschema-editing |
| `FormatDiagnosticReporter`      | `FormatDiagnosticReporter` in @bentley/ecschema-editing      |
| `LoggingDiagnosticReporter`     | `LoggingDiagnosticReporter` in @bentley/ecschema-editing     |
| `IRuleSet`                      | `IRuleSet` in @bentley/ecschema-editing                      |
| `ECRuleSet`                     | `ECRuleSet` in @bentley/ecschema-editing                     |
| `ISuppressionRule`              | `ISuppressionRule` in @bentley/ecschema-editing              |
| `BaseSuppressionRule`           | `BaseSuppressionRule` in @bentley/ecschema-editing           |
| `IRuleSuppressionMap`           | `IRuleSuppressionMap` in @bentley/ecschema-editing           |
| `BaseRuleSuppressionMap`        | `BaseRuleSuppressionMap` in @bentley/ecschema-editing        |
| `IRuleSuppressionSet`           | `IRuleSuppressionSet` in @bentley/ecschema-editing           |
| `SchemaCompareCodes`            | `SchemaCompareCodes` in @bentley/ecschema-editing            |
| `SchemaCompareDiagnostics`      | `SchemaCompareDiagnostics` in @bentley/ecschema-editing      |
| `SchemaValidater`               | `SchemaValidater` in @bentley/ecschema-editing               |
| `SchemaValidationVisitor`       | `SchemaValidationVisitor` in @bentley/ecschema-editing       |

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
