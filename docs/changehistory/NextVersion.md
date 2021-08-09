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

### @bentley/imodeljs-frontend

| Removed                           | Replacement                                               |
| --------------------------------- | --------------------------------------------------------- |
| `CheckpointConnection.open`       | `CheckpointConnection.openRemote`                         |
| `DecorateContext.screenViewport`  | `DecorateContext.viewport`                                |
| `IModelApp.iModelClient`          | `IModelHubFrontend.iModelClient`                          |
| `IModelConnection.Models.loaded`  | use `for..of` to iterate and `getLoaded` to look up by Id |
| `IOidcFrontendClient`             | `FrontendAuthorizationClient`                             |
| `isIOidcFrontendClient`           | `FrontendAuthorizationClient`                             |
| `OidcBrowserClient`               | `BrowserAuthorizationClient`                              |
| `OidcFrontendClientConfiguration` | `BrowserAuthorizationClientConfiguration`                 |
| `ScreenViewport.decorationDiv`    | `DecorateContext.addHtmlDecoration`                       |
| `ViewManager.forEachViewport`     | Use a `for..of` loop                                      |

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

| Removed                          | Replacement                                      |
| -------------------------------- | ------------------------------------------------ |
| `hasFlag`                        | `hasSelectionModeFlag` in @bentley/ui-components |
| `StandardEditorNames`            | `StandardEditorNames` in @bentley/ui-abstract    |
| `StandardTypeConverterTypeNames` | `StandardTypeNames` in @bentley/ui-abstract      |
| `StandardTypeNames`              | `StandardTypeNames` in @bentley/ui-abstract      |
| `Timeline`                       | `TimelineComponent` in @bentley/ui-components    |

### @bentley/ui-framework

| Removed                                | Replacement                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `COLOR_THEME_DEFAULT`                  | `SYSTEM_PREFERRED_COLOR_THEME` in @bentley/ui-framework is used as default color theme |
| `FunctionKey`                          | `FunctionKey` in @bentley/ui-abstract                                                  |
| `IModelAppUiSettings`                  | `UserSettingsStorage` in @bentley/ui-framework                                         |
| `reactElement` in ContentControl       | `ContentControl.reactNode`                                                             |
| `reactElement` in NavigationAidControl | `NavigationAidControl.reactNode`                                                       |
| `reactElement` in NavigationWidgetDef  | `NavigationWidgetDef.reactNode`                                                        |
| `reactElement` in ToolWidgetDef        | `ToolWidgetDef.reactNode`                                                              |
| `reactElement` in WidgetControl        | `WidgetControl.reactNode`                                                              |
| `reactElement` in WidgetDef            | `WidgetDef.reactNode`                                                                  |
| `ReactMessage`                         | `ReactMessage` in @bentley/ui-core                                                     |
| `SpecialKey`                           | `SpecialKey` in @bentley/ui-abstract                                                   |
| `WidgetState`                          | `WidgetState` in @bentley/ui-abstract                                                  |

### User Interface Changes

Several changes were made in the @bentley/ui-* packages.
Some components in @bentley/ui-core were deprecated in favor of components in @itwinui-react.
A few constructs were deprecated in @bentley/ui-core package with alternatives elsewhere.

#### Deprecated ui-core Components in Favor of iTwinUI-react Components

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

##### Slider

The deprecated [Slider]($ui-core) was a wrapper around the react-compound-slider that does not work properly in popout windows. To eliminate this issue, the deprecated `Slider`will now wrap the  `Slider` component from @itwin/itwinui-react. This result is a couple prop changes. The `onSlideStart` or `onSlideEnd` props are ignored, use `onUpdate` and `onChange` props if needed. The only two `modes` that remain supported are 1 and 2.

#### Deprecated with alternatives elsewhere

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
