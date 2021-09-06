---
publish: false
---
# NextVersion

## Build tools changes

Removed TSLint support from `@bentley/build-tools`. If you're still using it, please switch to ESLint.
Also removed legacy `.eslintrc.js` file from the same package. Instead, use `@bentley/eslint-plugin` and the `imodeljs-recommended` config included in it.

## `Viewport.zoomToElements` improvements

[Viewport.zoomToElements]($frontend) accepts any number of element Ids and fits the viewport to the union of their [Placement]($common)s. A handful of shortcomings of the previous implementation have been addressed:

* Previously, the element Ids were passed to [IModelConnection.Elements.getProps]($frontend), which returned **all** of the element's properties (potentially many megabytes of data), only to extract the [PlacementProps]($common) for each element and discard the rest. Now, it uses the new [IModelConnection.Elements.getPlacements]($frontend) function to query only the placements.
* Previously, if a mix of 2d and 3d elements were specified, the viewport would attempt to union their 2d and 3d placements, typically causing it to fit incorrectly because 2d elements reside in a different coordinate space than 3d elements. Now, the viewport ignores 2d elements if it is viewing a 3d view, and vice-versa.

## Breaking changes

### Continued transition to `ChangesetIndex`

Every Changeset has both an Id (a string hash of its content and parent changeset) and an Index (a small integer representing its relative position on the iModel's timeline.) Either value can be used to uniquely identify a changeset. However, it is often necessary to compare two changeset identifiers to determine relative order, or to supply a range of changesets of interest. In this case, Id is not useful and must be converted to an index via a round-trip to an iModelHub server. Unfortunately, much of the iModel.js api uses only [ChangesetId]($common) to identify a changeset. That was unfortunate, since [ChangesetIndex]($common) is frequently needed and `ChangesetId` is rarely useful. For this reason we are migrating the api to prefer `ChangesetIndex` over several releases.

In version 2.19, we introduced the type [ChangesetIdWithIndex]($common) to begin that migration. However, for 2.x compatibility we could not use it several places where it would have been helpful:

* [IModelRpcOpenProps]($common)
* [CheckpointProps]($backend)
* [LocalBriefcaseProps]($common)

Each of these interfaces originally had only a member `changeSetId: string`, In 2.19, for backwards compatibility, a new member `changeSetIndex?: number` was added. In V3 those two members are now replaced with a single member `changeset: ChangesetIdWithIndex`. Note that this is a breaking change, and you may have to adjust your code. To get the changeset Id, use `changeset.id`. To get the changeset Index, use `changeset.index` (may be undefined). In V4, this will become `changeset: ChangesetIndexAndId` and index will be required.

> Note: "Changeset" is one word. Apis should not use a capital "S" when referring to them.

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
```
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

## Removal of previously deprecated APIs

In this 3.0 major release, we have removed several APIs that were previously marked as deprecated in 2.x. Generally, the reason for the deprecation as well as the alternative suggestions can be found in the 2.x release notes. They are summarized here for quick reference.

### @bentley/imodeljs-backend

| Removed                                                      | Replacement                                    |
| ------------------------------------------------------------ | ---------------------------------------------- |
| `AutoPush`                                                   | *eliminated*                                   |
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

| Removed                                       | Replacement                                                     |
| --------------------------------------------- | --------------------------------------------------------------- |
| `Code.getValue`                               | `Code.value`                                                    |
| `CodeSpec.specScopeType`                      | `CodeSpec.scopeType`                                            |
| `IModel.changeSetId`                          | `IModel.changeset.id`                                           |
| `IModelVersion.evaluateChangeSet`             | `IModelHost`/`IModelApp` `hubAccess.getChangesetIdFromVersion`  |
| `IModelVersion.fromJson`                      | `IModelVersion.fromJSON`                                        |
| `IModelVersion.getChangeSetFromNamedVersion`  | `IModelHost`/`IModelApp` `hubAccess.getChangesetIdFromVersion`  |
| `IModelVersion.getLatestChangeSetId`          | `IModelHost`/`IModelApp` `hubAccess.getChangesetIdFromVersion`  |
| `IModelWriteRpcInterface`                     | Use IPC for writing to iModels                                  |
| `ViewFlagOverrides` class                     | [ViewFlagOverrides]($common) type                               |
| `ViewFlagProps.edgeMask`                      | *eliminated*                                                    |
| `ViewFlagProps.hlMatColors`                   | *eliminated*                                                    |
| `ViewFlags.clone`                             | [ViewFlags.copy]($common)
| `ViewFlags.edgeMask`                          | *eliminated*                                                    |
| `ViewFlags.hLineMaterialColors`               | *eliminated*                                                    |
| `ViewFlags.noCameraLights`                    | [ViewFlags.lighting]($common)                                   |
| `ViewFlags.noGeometryMap`                     | *eliminated*                                                    |
| `ViewFlags.noSolarLight`                      | [ViewFlags.lighting]($common)                                   |
| `ViewFlags.noSourceLights`                    | [ViewFlags.lighting]($common)                                   |

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
| `ViewManager.forEachViewport`          | Use a `for..of` loop                                      |
| `UnitSystemKey`                        | Moved to `@bentley/imodeljs-quantity`                     |

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

| Removed                                 | Replacement                                                 |
| --------------------------------------- | ----------------------------------------------------------- |
| `hasFlag`                               | `hasSelectionModeFlag` in @bentley/ui-components            |
| `StandardEditorNames`                   | `StandardEditorNames` in @bentley/ui-abstract               |
| `StandardTypeConverterTypeNames`        | `StandardTypeNames` in @bentley/ui-abstract                 |
| `StandardTypeNames`                     | `StandardTypeNames` in @bentley/ui-abstract                 |
| `Timeline`                              | `TimelineComponent` in @bentley/ui-components               |
| `ControlledTreeProps.treeEvents`        | `ControlledTreeProps.eventsHandler`                         |
| `ControlledTreeProps.visibleNodes`      | `ControlledTreeProps.model`                                 |
| `MutableTreeModel.computeVisibleNodes`  | `computeVisibleNodes` in @bentley/ui-components             |
| `TreeModelSource.getVisibleNodes`       | memoized result of `computeVisibleNodes`                    |
| `useVisibleTreeNodes`                   | `useTreeModel` and `computeVisibleNodes`                    |

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

| Removed                                | Replacement                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `Config`                               | Use `process.env` to access environment variables directly |
| `EnvMacroSubst`                        | *eliminated*  |

### @bentley/presentation-common

| Removed                                  | Replacement                                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `PresentationRpcInterface.loadHierarchy` | *eliminated*                                                                           |
| `PresentationUnitSystem`                 | Removed in favor of `UnitSystemKey` from `@bentley/imodeljs-quantity`                  |

### @bentley/presentation-backend

| Removed                                     | Replacement                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `PresentationManager.loadHierarchy`         | *eliminated*                                                                           |
| `UnitSystemFormat.unitSystems`              | Changed type from `PresentationUnitSystem[]` to `UnitSystemKey[]`                      |
| `PresentationManagerProps.activeUnitSystem` | Changed type from `PresentationUnitSystem` to `UnitSystemKey`                          |
| `PresentationManager.activeUnitSystem`      | Changed type from `PresentationUnitSystem` to `UnitSystemKey`                          |

### @bentley/presentation-frontend

| Removed                                     | Replacement                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `PresentationManager.loadHierarchy`         | *eliminated*                                                                           |
| `PresentationManagerProps.activeUnitSystem` | Changed type from `PresentationUnitSystem` to `UnitSystemKey`                          |
| `PresentationManager.activeUnitSystem`      | Changed type from `PresentationUnitSystem` to `UnitSystemKey`                          |

### @bentley/presentation-components

| Removed                                               | Replacement                                                                            |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `IPresentationTreeDataProvider.loadHierarchy`         | *eliminated*                                                                           |
| `PresentationTreeDataProvider.loadHierarchy`          | *eliminated*                                                                           |
| `FilteredPresentationTreeDataProvider.loadHierarchy`  | *eliminated*                                                                           |
| `DEPRECATED_controlledTreeWithFilteringSupport`       | *eliminated*                                                                           |
| `DEPRECATED_controlledTreeWithVisibleNodes`           | *eliminated*                                                                           |

<!---
User Interface Changes - section to comment below
-->

### User Interface Changes

Several changes were made in the @bentley/ui-* packages.
Some components in @bentley/ui-core were deprecated in favor of components in @itwinui-react.
A few constructs were deprecated in @bentley/ui-core package with alternatives elsewhere.
A new @bentley/ui-imodel-components package has been added and contains items related to Color, Cube, LineWeight, Navigation Aids, Quantity Inputs, Timeline and Viewport.

The @bentley/ui-* and @bentley/presentation-components packages are now dependent on React version 17. **Applications using the ui packages must update React 17.** Details about React version 17 can be found in the [React Blog](https://reactjs.org/blog/2020/10/20/react-v17.html).

For migration purposes, React 16 is included in the peerDependencies for the packages. React 16 is not an officially supported version of iTwin.js app or Extension development using the iTwin.js AppUi.

#### New Floating Widget Capabilities

Widgets provided via UiItemsProviders may now set `defaultState: WidgetState.Floating` and `isFloatingStateSupported: true` to open
the widget in a floating container. The property `defaultFloatingPosition` may also be specified to define the position of the floating container. If a position is not defined the container will be centered in the `AppUi` area.

The method `getFloatingWidgetContainerIds()` has been added to FrontstageDef to retrieve the Ids for all floating widget containers for the active frontstage as specified by the `frontstageDef`. These ids can be used to query the size of the floating container via `frontstageDef.getFloatingWidgetContainerBounds`. The method `frontstageDef.setFloatingWidgetContainerBounds` can then be used to set the size and position of a floating widget container.

#### `ControlledTree` API Changes

`ControlledTree` component has received the following breaking changes:

* The component now takes `TreeModel` rather than `VisibleTreeNodes` as a prop to avoid requiring consumers to manage `VisibleTreeNodes` object. As a result, the `useVisibleTreeNodes` hook was replaced with `useTreeModel` hook. Typical migration:

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

* Name of the `treeEvents` prop was changed to `eventsHandler` to make it clearer. Typical migration:

  **Before:**

  ```tsx
  return <ControlledTree treeEvents={eventsHandler} {...otherProps} />;
  ```

  **After:**

  ```tsx
  return <ControlledTree eventsHandler={eventsHandler} {...otherProps} />;
  ```

* Made the props `width` and `height` required. Previously they were optional and forced us to use non-optimal approach when not provided. Now it's up to the consumer to tell the size of the component. Typical migration:

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

### Deprecated ui-core Components in Favor of iTwinUI-react Components

Several UI components in the @bentley/ui-core package have been deprecated.
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

* ColorPickerButton, ColorPickerDialog, ColorPickerPopup, ColorPropertyEditor, ColorSwatch
* Cube, CubeNavigationAid, CubeRotationChangeEventArgs
* DrawingNavigationAid
* QuantityInput, QuantityNumberInput
* TimelineComponent, TimelineDataProvider, TimelineMenuItemProps
* ViewportComponent, ViewportComponentEvents
* LineWeightSwatch, WeightPickerButton, WeightPropertyEditor

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
