# Change Log - @bentley/ui-framework

This log was last generated on Mon, 03 Jun 2019 18:09:39 GMT and should not be manually modified.

## 1.0.0
Mon, 03 Jun 2019 18:09:39 GMT

### Updates

- Switched from iModelHub Project API to Context API
- Disable SyncUi test that occasionally fails on CI job.
- Added UI Logger & UiError usage & improved i18n calls
- Fix spelling error and rename frontstageKey to iModelId since token was used to inform ui when imodel changed.
- Fix setWidgetState(Hidden)
- Support touch move for navigation controls.
- Moved NoChildrenProps, OmitChildrenProp and flattenChildren to ui-core from ui-ninezone
- Added Overflow button support
- InputFieldMessages are now hosted by ConfigurableUiContent control.
- Release tag cleanup and ui-framework unit tests
- Updated UI package release tags for 1.0 release.
- Fixed release tag warnings in UI packages
- Removed use of OidcClientWrapper. 
- Remove console log message output by SyncUiEventDispatcher. Add Logging.
- Changed some release tags from @hidden to @internal
- Add alpha level support for solar timeline
- Fix widget content renderer when widget prop changes.
- Prevent configurableui wrapper from creating a stacking context.
- Use the updated onCheckboxClick API inside ModelSelectorTree and VisibilityTree.
- Visibility Tree: Fix reference subjects being hidden even when they have nested subjects
- Visibility Tree: Fix statuses of subjects and elements
- Visibility Tree: Refactor subjects' status checking and elements' category and model ids' retrieval for better performance
- Visibility Tree: Enable all subcategories' display when making category visible
- #124300. Add a notification event when a view is chosen in ViewSelector. #124295. ViewSelector incorrectly handles the case when a selected view has not initialized with a viewport.
- Added ViewSelectorChangedEvent

## 0.191.0
Mon, 13 May 2019 15:52:05 GMT

### Updates

- Update to when active tool properties are cached for toolsettings.
- Fixed NotificationManager.openMessageBox amd OutputMessageAlert.Dialog implementations to support HTML tags
- @beta tags for Toolbar. More React.PureComponent usage. Added constructors to prevent deprecated warnings. Coverage minimum thresholds.
- Fixed AppButton onClick on Firefox and bar color
- Removed Redux from AppState in ui-test-app and made Backstage stateful
- Refactor category/model picker
- CommonProps usage in ui-framework. SvgPath sample in ui-test-app. Added tools/build/tslint-docs.json.
- Added 'Register' link back to SignIn component. Added ExternalIModel test widget. Made AppBackstage in ui-test-app Redux connected again.
- Added missing package prefix to some CSS class names in ui-core, ui-components & ui-framework
- Reverted CubeNavigationAid changes
- Added 2D drawing navigation aid
- Added 100% coverage to DrawingNavigationAid, fixed snapshot leaks for InputField.test.snap
- Show/Hide UI enhancements. Widget Opacity enhancements.
- Added local snapshot support to ui-test-app. Added specialized div components to ui-core.
- Fix broken links
- Fixed Viewport heights & initial navigation aid. Widget transparency.
- Added StagePanel support to the Frontstage
- From hackathon-ui-team: StagePanels, UI Show/Hide, PopupButtons
- Put sourcemap in npm package.
- Correctly align ElementTooltip in subsequent Viewports.
- Render ElementTooltip above ViewportDialog.
- Add unmount component test.
- Move AnalysisAnimation Tool to ui-test-app. To be replaced by new timeline animation component.
- Fixed navigation aid bugs
- Fixes to OidcBrowserClient. 
- Added SignIn presentational component to ui-components. Removed --ignoreMissingTags extract-api option.
- Require React & React-dom 16.8
- remove IModelApp subclasses
- Setup a generic context for tracking client requests, and made various related enhancements to logging, usage tracking and authorization. 
- Added ViewportDialog in ui-test-app, ui-core/ContributeGuidelines.md. TSLint rules in ui-core for no-default-export & completed-docs. @beta release tags.
- Minimized serialization/deserialization costs when round tripping SAML based AccessToken-s. 
- Rename AppState to SessionState to avoid collision with acutal App's state. Add AvailableSectionScopes to SessionState.
- Move SelectionScope status field from test app to ui-framework. Update icons-generic-webfont version to latest available.
- Remove need to sync SelectionMethod since it is not changed within tool code.
- Move timeline components from ui-test-app to ui-components package
- Tool Settings: removed minimize tab, added min to title bar, styled title
- Auto close popups when clicking outside.
- Return rulset promises in Category/Model picker _initialize()
- Use GlobalContextMenu in category picker and modify to better follow UX standards.
- Added ui-framework release tags and common/api/ui-framework.api.md
- UI documentation - added to Learning section
- Fix hidden tabs issue.
- Added ModelessDialog & ModelessDialogManager
- In Category picker show only categories with elements
- Check for ruleset before removing
- Wait for category/model rulsets to load before creating groups.
- Manage category picker tree nodes via id instead of node
- Fix Model Selector's ruleset. It contained invalid ECExpression for LabelOverride rule which caused labels in some cases to be incorrect and ECExpression parsing errors in our logs.
- Prevent widget content unmount.
- Removed IStatusBar and fixed incorrect Toast animateOuTo prop value.
- Visibility Tree: Use per-model category display overrides
- Visibility Tree: Show tooltips explaining why checkbox status is what it is
- Visibility Tree: Fix some subjects not being displayed in the hierarchy
- Visibility Tree: Do not show nodes for reference subjects with no children
- Visibility Tree: Set correct icons
- Visibility Tree: Update hierarchy to hide specific kinds of nodes
- Visibility Tree: When changing assembly display state, also change its children state
- Visibility Tree: Update checkbox states when activeView prop is changed
- Visibility Tree: Set paging size on the data provider to avoid excessive backend requests
- Update tests for better coverage and move certain components to test app that should not be in framework.
- Unit tests and fixed ColorEditor alignment
- Upgrade TypeDoc dependency to 0.14.2
- Add ListPickerBase test to trigger item expansion.
- Changed props for CubeRotationChangeEvents

## 0.190.0
Thu, 14 Mar 2019 14:26:49 GMT

### Updates

- Added 'uifw-' to ContentLayout CSS class names and others. Fixed Status Bar separators.
- Added 'uifw-' prefix to most ui-framework CSS class names
- Fixed .npmignore in ui-framework to include JSON files in lib
- Cleaned up index.scss for variables & mixins in ui-core and added classes.scss that generates CSS
- Add SaturationPicker for use with ColorType editor.
- Made ContentLayoutManager.setActiveLayout callable by apps
- Update ModelSelector when changes are made to ViewState
- Add models visibility tree

## 0.189.0
Wed, 06 Mar 2019 15:41:22 GMT

### Updates

- OIDC changes needed for Angular client
- Renamed CSS files to SCSS
- UI documentation fixes
- Added ToggleEditor. Support for defaultTool in Frontstage. Fixed BooleanEditor sizing.
- Use new buildIModelJsBuild script
- Removed rowHeight function from ModelSelector, because heights changed to default.
- Updated view query in ViewSelector to exclude private views
- Remove unneeded typedoc plugin dependency
- Support for including CSS files in published UI packages
- Include descriptions (if any) in category and model picker
- Added styling capability to messages
- More ui-framework unit tests
- Removed dependency on BWC. Parts of BWC copied into ui-core in preparation for theming support.
- Added ToggleEditor. Support for defaultTool in Frontstage.
- Save BUILD_SEMVER to globally accessible map
- Change setImmediate to setTimeout. Fixed cube rotation issue.
- Cleanup of DefaultToolSetting provider
- Move property definitions to imodeljs-frontend so they could be used by tools to define properties for tool settings.
- Fixed ModelSelector highlighting when hovered or clicked on node.
- Fixed ModelSelector row height.
- Added priority support for pointer messages
- Change 'Categories' ruleset to return either spatial or drawing categories based on ruleset variable
- Changed node style processing in model selector
- Set initial ModelSelector selection based on ViewState
- Load models when selected in picker
- Force scene invalidation when toggling items in model selector
- Render unique filter in model/category widget when changing tabs
- Add spinner to model/category widget
- Cache model/category tree
- Make one call to update viewport
- Enabled descriptions in model selector
- Map model/category nodes to items with unique id
- Show spinner while waiting to load category list
- Added strings for reality data picker
- Added support for UI color themes
- Keyboard Shortcut keys in context menu. ui-core unit test branches.
- Fix dependencies
- Update to use newer generic-icons-webfont package.
- upgrade to TypeScript 3.2.2
- WIP: ViewportComponent unit tests. Removed imodeljs-clients-backend dependency from ui-framework

## 0.188.0
Wed, 16 Jan 2019 16:36:09 GMT

*Version update only*

## 0.187.0
Tue, 15 Jan 2019 15:18:59 GMT

*Version update only*

## 0.186.0
Mon, 14 Jan 2019 23:09:10 GMT

### Updates

- Added activated, deactivated & ready notification for Frontstages. Added support for nested frontstages.
- Add Status Field to show selection count

## 0.185.0
Fri, 11 Jan 2019 18:29:00 GMT

*Version update only*

## 0.184.0
Thu, 10 Jan 2019 22:46:17 GMT

### Updates

- Improved state management in ModelSelector
- Improve performance for show/hide/invert buttons in model selector
- Clearing content controls on Frontstage deactivate
- Keyboard Shortcut support
- Renamed connection getter to imodel

## 0.183.0
Mon, 07 Jan 2019 21:49:21 GMT

*Version update only*

## 0.182.0
Mon, 07 Jan 2019 13:31:34 GMT

### Updates

- Do not show SubCategory if it has no siblings

## 0.181.0
Fri, 04 Jan 2019 13:02:40 GMT

### Updates

- Add SyncUi support for ConfigurableUi controls.

## 0.180.0
Wed, 02 Jan 2019 15:18:23 GMT

*Version update only*

## 0.179.0
Wed, 19 Dec 2018 18:26:14 GMT

### Updates

- Added showDialogInitially support to ActivityMessageDetails
- Synchronizing navigation aids with view definition changes
- Fix model selector to only show non-private spatial models

## 0.178.0
Thu, 13 Dec 2018 22:06:10 GMT

### Updates

- Added StringGetter support to ItemDefBase, ItemProps & ToolButton. Added IModelApp.i18n checks to Tool for unit tests.
- Fix tool panel alignment issue.

## 0.177.0
Wed, 12 Dec 2018 17:21:32 GMT

### Updates

- Moved checkbox responsibility to nodes
- Improved speed & smoothness of CubeNavigationAid. Made class names unique to fix documentation. UI Tree doc fixes.

## 0.176.0
Mon, 10 Dec 2018 21:19:45 GMT

*Version update only*

## 0.175.0
Mon, 10 Dec 2018 17:08:55 GMT

*Version update only*

## 0.174.0
Mon, 10 Dec 2018 13:24:09 GMT

### Updates

- Add SignIn and SignOut to the index file

## 0.173.0
Thu, 06 Dec 2018 22:03:29 GMT

### Updates

- Added fillZone property to the Widget
- Fixed initial & return layout of Frontstage. Styling of scrollbar in Chrome.
- Custom imodelJs noDirectImport lint rule implemented, noDuplicateImport lint rule turned on.

## 0.172.0
Tue, 04 Dec 2018 17:24:39 GMT

### Updates

- Changed index file name to match package name, eliminate subdirectory index files, decrease usage of default exports, change imports to use other packages' index file.

## 0.171.0
Mon, 03 Dec 2018 18:52:58 GMT

### Updates

- More information logged from BriefcaseManager.\nFixed deletion/cleanup of invalid briefcases.\nAdded OIDC support for simpleviewtest application. 
- Unit tests
- Removed ConfigurableUiManager.addFrontstageDef and other unused/old methods and components

## 0.170.0
Mon, 26 Nov 2018 19:38:42 GMT

### Updates

- Fix to OIDC browser client. 

## 0.169.0
Tue, 20 Nov 2018 16:17:15 GMT

### Updates

- Include presentation rulesets in package

## 0.168.0
Sat, 17 Nov 2018 14:20:11 GMT

### Updates

- Fixed OidcBrowserClient comparision of redirect path.

## 0.167.0
Fri, 16 Nov 2018 21:45:44 GMT

### Updates

- Overhaul category/model picker to use presentation rules
- Fixed some content control sizing issues
- Moved most isHidden logic for toolbar items into ui-ninezone
- Hiding items by rendering them conditionally instead of using a CSS class.
- Fixed tests
- Tree cell editing unit tests
- ui-framework unit tests & docs

## 0.166.0
Mon, 12 Nov 2018 16:42:10 GMT

*Version update only*

## 0.165.0
Mon, 12 Nov 2018 15:47:00 GMT

*Version update only*

## 0.164.0
Thu, 08 Nov 2018 17:59:21 GMT

### Updates

- OIDC related enhancments (WIP). 
- Updated to TypeScript 3.1
- ui-core unit tests. Fixed backstage open issue.
- Zone & Widget initial state, more ui-core unit tests, cleaned up ui-framework index.ts files.

## 0.163.0
Wed, 31 Oct 2018 20:55:37 GMT

### Updates

- Added JSX specification for Frontstage, Zone & Widget
- Fixed ui-framework unit test

## 0.162.0
Wed, 24 Oct 2018 19:20:07 GMT

### Updates

- Merge and fix framework test warning
- Tooltips, ToolAdmin.activeToolChanged support, SheetNavigationAid/SheetsModalFrontstage improvements.
- Ui Documentation
- Vertical PropertyGrid layout improvements. PropertyGrid background color. Setting the widget state.
- Added NotificationManager.isToolTipSupported so that we can avoid asking for tooltip message when _showToolTip isn't implemented by application.
- Adding SyncUiEventDispatcher

## 0.161.0
Fri, 19 Oct 2018 13:04:14 GMT

*Version update only*

## 0.160.0
Wed, 17 Oct 2018 18:18:38 GMT

*Version update only*

## 0.159.0
Tue, 16 Oct 2018 14:09:09 GMT

*Version update only*

## 0.158.0
Mon, 15 Oct 2018 19:36:09 GMT

*Version update only*

## 0.157.0
Sun, 14 Oct 2018 17:20:06 GMT

### Updates

- Fixing scripts for linux

## 0.156.0
Fri, 12 Oct 2018 23:00:10 GMT

### Updates

- Initial release

