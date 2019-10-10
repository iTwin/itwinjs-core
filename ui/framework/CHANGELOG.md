# Change Log - @bentley/ui-framework

This log was last generated on Wed, 09 Oct 2019 20:28:43 GMT and should not be manually modified.

## 1.6.0
Wed, 09 Oct 2019 20:28:43 GMT

### Updates

- Add support for CursorMenu
- Clear internal row/column selection data when number or rows change in Table. Add definitions for platform MeasureTools.
- Fix Tool Settings label to ensure it stays in sync with active tool.
- Added AutoSuggest component and improved KeyinBrowser component
- Close tool group panel on toolbar item click.
- Ability to drag and resize tool settings widget.
- Ignore widgetDef state in WidgetContentRenderer of tool settings.

## 1.5.0
Mon, 30 Sep 2019 22:28:48 GMT

### Updates

- AccuDraw Popup Editors. Improved editor sizes. Editor Params improvements.
- Initial Accudraw Ui components - Buttons, ContextMenus, Calculator, Editors. IconInput in ui-core.
- Backport Sections and ViewAttributes Status Fields from Design Review for use with plugins.
- Cursor Prompt no longer displays as small blank popup when Tool Assistance instruction is blank
- Fixed Frontstage resizing problem exposed by Chrome update
- #168241 Don't try to correct clip plane handle location when plane has been moved outside project extents. Updated image for two finger drag svg.
- Changed ToolWidget, NavigatonWidget, and Toolbar render method to only render items in state and to not generate them during render.
- Add support for panelLabel property for a GoupButton. This is the title that is shown when the group is opened.
- Added FrontstageProvider.initializeDef param for FrontstageDef
- Correct ViewClipByPlaneTool icon.
- UiDataProvider class, work on PluginUiProvider
- Change BackstageItemSpec to use localized strings not keys to be localized due to the way Plugins provide localization.
- Create a common IModelViewPort control that supports Design Review and ui-test-app.
- Add ability to pre-load hierarchies in Visibility Widget
- Tool Assistance changes per UX Design
- Support for Modifier key + wide SVG
- Tool Assistance for Ctrl+Z and other chars
- Fixed ToolAssistanceField pin problem
- #168481 Tool assistance: Measure tools, view clip tools, and touch cursor inputs.
- Added touch entries to ToolAssistanceImage
- Joe G required the tree (empty data) be more descriptive and generic.
- In the Model/Category/Spatial trees, center the error message
- upgrade to TypeScript 3.6.2
- Ability to collapse stage panel using StagePanelDef.
- Stage panel header.
- Make components aware of safe area insets.

## 1.4.0
Tue, 10 Sep 2019 12:09:49 GMT

### Updates

- Using Checkbox component in BooleanEditor. Cleaned up cell editor positioning.
- Updated inputs and button padding for iModel.js. Fixed Popup colors & z-index.
- Added support for content view minSize properties
- Fixed SplitPane pane 2 size. Upgraded react-split-pane to 0.1.87.
- Addressed some warnings introduced with React 16.9
- Listening for onSelectedViewportChanged to set active content view for viewports
- Had to back up to react-split-pane 0.1.77
- #165662. Allow an app to specify touch-specific instructions in tool assistance.
- Visibility Component: Preserve active tree state by saving and restoring scroll position

## 1.3.0
Tue, 13 Aug 2019 20:25:53 GMT

### Updates

- Add markupTool definitions. Update to use latest icon library
- Add support for BackstageComposer so Plugins can add backstage items.
- Fix dragged widget offset.
- Widget with isToolSettings honors defaultState
- Move MarkupTool definitions to their own class.
- Fixed location of ContentLayout within 9-zone area and Stage Panels
- Added CursorPopupRenderer to render multiple CursorPopups per RelativePosition.
- Added CursorPrompt, improved Pointer messages
- Added @bentley/icons-generic to dependencies which was wrongly set in devDependencies.
- #159907. Fixed Group Button history is overlapping a Popup Button panel when hovering over the Group button
- Allow enter key in arguments field of keyin browser to trigger command execution. Select text on focus in to allow easy argument replacement
- Added icons to markup/redline
- Fixed Zone mergeWithZone processing
- Port RealityData widget from Design Review.
- Added icon for redline text tool
- Update FilteringInput to use updated search box design from UX. Also updated ModelSelectorTree to work with changes and marked ModelSelector as deprecated.
- Add tool assistance for SelectTool.
- Update SelectTool to display tool setting by default.
- Moved Point, PointProps, Rectangle, RectangleProps, Size and SizeProps to ui-core from ui-ninezone
- Improved ToolAssistance item spacing. ViewSelector shows current view.
- Made Tool Settings tab tooltip more concise & clearer
- Close ListPicker popup when clicking the button.
- Initialize stage panel size from size prop.
- VisibilityTree: Fix not all models' visibility being changed when changing visibility of parent subject
- Visibility Tree: Handle `Viewport.isAlwaysDrawnExclusive` flag when determining and handling Element display states
- Backport Visibility Widget from Design Review
- Update to latest icon package version.

## 1.2.0
Wed, 24 Jul 2019 11:47:26 GMT

### Updates

- Update so both Tool and Navigation wigets refresh when PluginUiProvider is loaded.
- Support ToolbarItemInsertSpecs with conditional visibility. Update toolbar processing to better handle situations where number of visible items change.
- Add support for GroupItemInsertSpec, badges, and svg symbolId in ToolbarItemInsertSpecs
- Bug 148507: Removed redundant call to OidcClient.initialize in UiFramework.
- Add PluginUiManager class and PluginUiProvider interface that will be used by Plugins to specify UI components to add to an iModeljs application.
- Added CursorInformation and CursorPopup
- Upgraded to Redux 4.0.3 that fixed combineReducers
- Add basic support to display an svg file for an toolbar item image.
- Added ToolAssistance support and Tool.iconSpec
- Fixed Toolbar resizing, ContextMenu className and $buic-row-hover & $buic-row-selection
- Rerender widget tabs when WidgetDef changes.
- Close ListPicker on outside click.
- Ability to close Panel of PopupButton.
- remove node selection logic from model Tree
- Convert Widget, Zone and StagePanel components to PureComponents.
- Model Picker: Fix presentation ruleset
- VisibilityTree: Update visual styles.
- Visibility Tree: Only show Subject nodes which have child Subjects, PhysicalPartitions or SpatialLocationPartitions.
- React to ui-ninezone changes.

## 1.1.0
Mon, 01 Jul 2019 19:04:29 GMT

### Updates

- Added beta badge support to toolbar buttons and widget tabs
- Cleaned up console warnings
- Eliminate need to cache tool setting properties by ensuring active tool is available before activeToolChanged event is fired.
- Added prefixes to Dialog & ContextMenu to CSS classes for positioning
- Removed missing group descriptions
- Added support for 'HTMLElement | string' for message strings
- Fixed Minimum/Maximum window toast message spam
- Update tests.
- Fixed ActionButtonItemDef random key unit test
- Removed 4 dangerouslySetInnerHtml usages to help with Security audit; 3 remain on purpose.
- Save & Restore View Layouts
- Fix Bug 127182 - Force toolsettings to refresh when a tool is started even if new toolId is same as active toolId.
- Added *.svg to .npmignore file
- #137311 - Fix issue where cached tool settings values in UI would get out of sync with actual values in tool.
- Update to TypeScript 3.5
- Fix model selector view sync problem
- Added MessageManager.addToMessageCenter. ui-framework unit tests.
- Reuse ui-ninezone stage panels.
- Visibility Tree: Auto-expand root node
- Visibility Tree: Fix incorrect category status when category is displayed directly under subject
- Visibility Tree: Use a more fool-proof node type checking
- Visibility Tree: Update subject node icons
- Visibility Tree: Disable subjects and models if active view is not spatial
- Visibility Tree: Avoid re-rendering the tree multiple times when receiving multiple view change notifications in a row
- The VisibilityTree component now ensures displayed models are loaded.
- Added ViewSelector.updateShowSettings to control which view types are displayed

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

