# Change Log - @bentley/ui-core

This log was last generated on Tue, 07 Jan 2020 19:44:01 GMT and should not be manually modified.

## 1.10.0
Tue, 07 Jan 2020 19:44:01 GMT

### Updates

- Fixed lgtm issues in UI folders

## 1.9.0
Tue, 10 Dec 2019 18:08:56 GMT

### Updates

- No longer accessing this.state or this.props in setState updater - flagged by lgtm report
- Changed SignIn & SignOut buttons to large. Fixed Dialog component resizing. Reduced default minimum size of Dialog component.
- Update sinon version.
- Use exhaustive-deps linter rule.
- Removed unused React state variables. Removed unsupported setState calls from render() methods.
- Code cleanup based on code analysis report from lgtm.
- Added ConditionalField and FooterModeField components. StatusBar responsive changes.

## 1.8.0
Fri, 22 Nov 2019 14:03:34 GMT

### Updates

- Update Icon package version
- Fixed Dialog position after moving or resizing. Fixed sizing on Firefox for different alignments.
- Implemented more efficient CSS animation for Spinner component
- Added slight delay before spinner animation. LoadingSpinnner tests in SpinnerTestDialog.
- Tablet responsive UI
- Added StatusBarComposer, StatusBarItem, StatusBarManager and StatusBarItemsManager
- Added tslint-react-hooks to UI packages
- Add useEffectSkipFirst custom hook
- Update Statusbar index scss file.

## 1.7.0
Fri, 01 Nov 2019 13:28:37 GMT

### Updates

- Provide a generic Form component to replace the one in Design Review Saftibase and Risk Manangement stages.
- Added badge support to context menu items. Moved some Plugin Ui definitions to ui-abstract.
- Added support for English key-ins in addition to translated key-ins
- Fix centering and sizing of dialogs in FireFox.
- Made the Status Bar & Backstage more responsive on smaller screens
- Added initial ui-abstract package setup
- Added UiAdmin with support for displaying Menus and Toolbars at a location
- Fixed SVG support in ui-core
- Added useLifecycleLogging hook to help debugging react functional components

## 1.6.0
Wed, 09 Oct 2019 20:28:42 GMT

### Updates

- Added AutoSuggest component and improved KeyinBrowser component

## 1.5.0
Mon, 30 Sep 2019 22:28:48 GMT

### Updates

- AccuDraw Popup Editors. Improved editor sizes. Editor Params improvements.
- Initial Accudraw Ui components - Buttons, ContextMenus, Calculator, Editors. IconInput in ui-core.
- Added hideHeader and header props and support for titleStyle prop
- Added initial (default) value to Search Box.
- Tool Assistance changes per UX Design
- upgrade to TypeScript 3.6.2

## 1.4.0
Tue, 10 Sep 2019 12:09:49 GMT

### Updates

- Using Checkbox component in BooleanEditor. Cleaned up cell editor positioning.
- Updated inputs and button padding for iModel.js. Fixed Popup colors & z-index.
- Added support for content view minSize properties
- Addressed some warnings introduced with React 16.9
- Listening for onSelectedViewportChanged to set active content view for viewports
- Fixed new lint issue in getDisplayName
- #165662. Allow an app to specify touch-specific instructions in tool assistance.
- Add a `ScrollPositionMaintainer` helper to recursively save and restore scroll position
- Added VerticalTabs component to ui-core

## 1.3.0
Tue, 13 Aug 2019 20:25:53 GMT

### Updates

- Update to use latest icon library
- Add missing 'uicore-' prefix to step color values.
- Added CursorPrompt, improved Pointer messages
- Fixed Dialog component height on different browsers
- Make icon specification on Tile component optional.
- Added icons to markup/redline
- Moved Point, PointProps, Rectangle, RectangleProps, Size and SizeProps to ui-core from ui-ninezone
- Copied Tiles over from BWC to ui-core
- Update to latest icon package version.

## 1.2.0
Wed, 24 Jul 2019 11:47:26 GMT

### Updates

- Checkbox: added theming
- Remove flex-grow from dialog containers - not supported by Firefox
- removed flex-grow from dialogs
- Add missing space in scss files.
- Update styles on Select and Input components.
- Added CursorInformation and CursorPopup
- Added ToolAssistance support and Tool.iconSpec
- Fixed Toolbar resizing, ContextMenu className and $buic-row-hover & $buic-row-selection
- Checkbox: Fix `onClick` event so that it can be used to stop event propagation
- Remove excessive z-index CSS rule.
- Update light and dark theme colors.

## 1.1.0
Mon, 01 Jul 2019 19:04:29 GMT

### Updates

- #137898 - It is not possible to turn on/off checkbox by clicking on label
- Added prefixes to Dialog & ContextMenu to CSS classes for positioning
- Copied source from react-numeric-input and converted to TypeScript for internal control
- Modified regex for NumericInput
- Allow CSS selector string to specify item in FocusTrap to receive focus.
- Reverted ContextMenuDirection and DialogAlignment breaking changes
- Update to TypeScript 3.5
- ui-core unit tests
- ui-core unit tests
- ui-component unit tests. NumericInput strict=true default.

## 1.0.0
Mon, 03 Jun 2019 18:09:39 GMT

### Updates

- Added UI Logger & UiError usage & improved i18n calls
- Change FrontStage to Frontstage
- Moved NoChildrenProps, OmitChildrenProp and flattenChildren to ui-core from ui-ninezone
- Release tag cleanup and ui-framework unit tests
- Updated UI package release tags for 1.0 release.
- Fixed release tag warnings in UI packages
- Add ability to save property only for current session.
- Added NumericInput component to ui-core. Added dependency on react-numeric-input.
- Update popup position when component updates.
- Remove unused z-index layers and move backstage to the end (since zones no longer create a stacking context).

## 0.191.0
Mon, 13 May 2019 15:52:05 GMT

### Updates

- Update to latest version of icon library.
- @beta tags for Toolbar. More React.PureComponent usage. Added constructors to prevent deprecated warnings. Coverage minimum thresholds.
- Added CommonProps to many component Props in ui-core & ui-components
- Added tools/build/tslint-docs.json. Added SvgPath & SvgSprite to ui-core.
- Added missing package prefix to some CSS class names in ui-core, ui-components & ui-framework
- Reverted CubeNavigationAid changes
- Added 100% coverage to getDisplayName and shallowDiffers
- Show/Hide UI enhancements. Widget Opacity enhancements.
- Added local snapshot support to ui-test-app. Added specialized div components to ui-core.
- Fix broken links
- Small tweak to Popup class.
- Put sourcemap in npm package.
- Added SignIn presentational component to ui-components. Removed --ignoreMissingTags extract-api option.
- Require React & React-dom 16.8
- Setup a generic context for tracking client requests, and made various related enhancements to logging, usage tracking and authorization. 
- Added ViewportDialog in ui-test-app, ui-core/ContributeGuidelines.md. TSLint rules in ui-core for no-default-export & completed-docs. @beta release tags.
- Update icons-generic-webfont version to latest available.
- Added TableProp to hide header and supporting style changes
- Fixed _scrollbar.scss include
- Modify GlobalContextMenu to better follow UX guidelines
- Added release tags to ui-framework, ui-components and ui-core.
- UI documentation - added to Learning section
- Fix tree placeholder styling (set correct background and offset)
- Added ModelessDialog & ModelessDialogManager
- Add onOutsideClick prop to Popup.
- Add ability to set tooltips on tree node checkboxes
- Unit tests and fixed ColorEditor alignment
- Upgrade TypeDoc dependency to 0.14.2

## 0.190.0
Thu, 14 Mar 2019 14:26:49 GMT

### Updates

- Added 'uifw-' to ContentLayout CSS class names and others. Fixed Status Bar separators.
- Added 'uifw-' prefix to most ui-framework CSS class names
- Cleaned up index.scss for variables & mixins in ui-core and added classes.scss that generates CSS
- Restructure `Node` component to allow more flexible layout

## 0.189.0
Wed, 06 Mar 2019 15:41:22 GMT

### Updates

- Renamed CSS files to SCSS
- UI documentation fixes
- Added ToggleEditor. Support for defaultTool in Frontstage. Fixed BooleanEditor sizing.
- Added testing props to SplitButton
- Added tilde-prefixed hotkey support to ContextMenu
- Use new buildIModelJsBuild script
- Changed Checkbox container from <label> to <span>, because the former caused weird visual glitch when clicked on.
- Color tweaks
- Fixed submenus, added default autoselect for hotkeys
- Added tests for Dialog and Context Menu
- Remove unneeded typedoc plugin dependency
- Minor UI Color Theme changes
- Support for including CSS files in published UI packages
- Added styling capability to messages
- Removed dependency on BWC. Parts of BWC copied into ui-core in preparation for theming support.
- Save BUILD_SEMVER to globally accessible map
- Added UnderlinedButton
- Cleanup of DefaultToolSetting provider and EnumButtonGroup editor
- Move property definitions to imodeljs-frontend so they could be used by tools to define properties for tool settings.
- Added Image component.
- Renamed core-tree-tree to core-tree.
- Removed Div component.
- Renamed icon container class in tree node to core-tree-node-icon.
- Made tree node checkbox container background transparent.
- Tree node checkbox css fix
- Tree node now accepts one checkbox prop object instead of multiple props.
- Changed tree node styling.
- Added support for UI color themes
- Add a way to specify custom Node checkbox renderer
- Keyboard Shortcut keys in context menu. ui-core unit test branches.
- Update to use newer generic-icons-webfont package.
- upgrade to TypeScript 3.2.2

## 0.188.0
Wed, 16 Jan 2019 16:36:09 GMT

*Version update only*

## 0.187.0
Tue, 15 Jan 2019 15:18:59 GMT

*Version update only*

## 0.186.0
Mon, 14 Jan 2019 23:09:10 GMT

*Version update only*

## 0.185.0
Fri, 11 Jan 2019 18:29:00 GMT

*Version update only*

## 0.184.0
Thu, 10 Jan 2019 22:46:17 GMT

### Updates

- Ensure unique relative file paths.

## 0.183.0
Mon, 07 Jan 2019 21:49:21 GMT

*Version update only*

## 0.182.0
Mon, 07 Jan 2019 13:31:34 GMT

*Version update only*

## 0.181.0
Fri, 04 Jan 2019 13:02:40 GMT

*Version update only*

## 0.180.0
Wed, 02 Jan 2019 15:18:23 GMT

### Updates

- Added tests for Dialog and Context Menu
- Changed the updateThreshold in ElementSeparator to be 3px instead of size percentage.
- TreeNode checkbox fixes

## 0.179.0
Wed, 19 Dec 2018 18:26:14 GMT

### Updates

- Use arrow cursor on tree nodes

## 0.178.0
Thu, 13 Dec 2018 22:06:10 GMT

*Version update only*

## 0.177.0
Wed, 12 Dec 2018 17:21:32 GMT

### Updates

- Updated TreeNodes to manage checkboxes
- Fix tree Node checkbox-related props

## 0.176.0
Mon, 10 Dec 2018 21:19:45 GMT

*Version update only*

## 0.175.0
Mon, 10 Dec 2018 17:08:55 GMT

*Version update only*

## 0.174.0
Mon, 10 Dec 2018 13:24:09 GMT

*Version update only*

## 0.173.0
Thu, 06 Dec 2018 22:03:29 GMT

### Updates

- Fixed initial & return layout of Frontstage. Styling of scrollbar in Chrome.
- Custom imodelJs noDirectImport lint rule implemented, noDuplicateImport lint rule turned on.

## 0.172.0
Tue, 04 Dec 2018 17:24:39 GMT

### Updates

- Changed index file name to match package name, eliminate subdirectory index files, decrease usage of default exports, change imports to use other packages' index file.

## 0.171.0
Mon, 03 Dec 2018 18:52:58 GMT

### Updates

- Fixed Dialog modal backdrop show/hide
- Reduced the amount of unneded event calls in Dialog component and changed it to use Pointer events instead of Mouse+Touch.
- Added a vertical/horizontal line that is visible when hovered on ElementSeparator component.
- Renamed expandable block css class from core-property-block to core-expandable-block.
- Added a way to put Popups in fixed position and cleand up the refs.
- Added Omit type definition to Utils.
- Unit tests
- Removed ConfigurableUiManager.addFrontstageDef and other unused/old methods and components
- Add Placeholder that can be displayed instead of tree node while it's being loaded

## 0.170.0
Mon, 26 Nov 2018 19:38:42 GMT

### Updates

- Reduced the amount of unneded event calls in Dialog component and changed it to use Pointer events instead of Mouse+Touch.
- Added a vertical/horizontal line that is visible when hovered on ElementSeparator component.
- Renamed expandable block css class from core-property-block to core-expandable-block.
- Added a way to put Popups in fixed position and cleand up the refs.
- Added Omit type definition to Utils.

## 0.169.0
Tue, 20 Nov 2018 16:17:15 GMT

### Updates

- Base Tree component improvements to allow virtualization

## 0.168.0
Sat, 17 Nov 2018 14:20:11 GMT

*Version update only*

## 0.167.0
Fri, 16 Nov 2018 21:45:44 GMT

### Updates

- Fixed some content control sizing issues
- Fixed Dialog movable prop and ContextMenu autoFlip.
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

- PropertyGrid property editing and unit tests
- Updated to TypeScript 3.1
- ui-core unit tests. Fixed backstage open issue.
- Make Tree-related components pure.
- Zone & Widget initial state, more ui-core unit tests, cleaned up ui-framework index.ts files.

## 0.163.0
Wed, 31 Oct 2018 20:55:37 GMT

### Updates

- Added JSX specification for Frontstage, Zone & Widget

## 0.162.0
Wed, 24 Oct 2018 19:20:07 GMT

### Updates

- Tooltips, ToolAdmin.activeToolChanged support, SheetNavigationAid/SheetsModalFrontstage improvements.
- Ui Documentation
- Vertical PropertyGrid layout improvements. PropertyGrid background color. Setting the widget state.
- Added an ElementSeparator component which allows resizing ratio between left/right column or upper/lower row.

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

