# Change Log - @bentley/ui-core

This log was last generated on Thu, 14 Mar 2019 14:26:49 GMT and should not be manually modified.

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

