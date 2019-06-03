# Change Log - @bentley/ui-ninezone

This log was last generated on Mon, 03 Jun 2019 18:09:39 GMT and should not be manually modified.

## 1.0.0
Mon, 03 Jun 2019 18:09:39 GMT

### Updates

- Added UI Logger & UiError usage & improved i18n calls
- Update to css-loader 2.1.1
- Moved NoChildrenProps, OmitChildrenProp and flattenChildren to ui-core from ui-ninezone
- Added Overflow button support
- Release tag cleanup and ui-framework unit tests
- Add support for solar timeline.
- Added NumericInput component to ui-core. Added dependency on react-numeric-input.
- Prevent zones component from creating a stacking context.

## 0.191.0
Mon, 13 May 2019 15:52:05 GMT

### Updates

- Update to latest version of icon library.
- @beta tags for Toolbar. More React.PureComponent usage. Added constructors to prevent deprecated warnings. Coverage minimum thresholds.
- Fixed AppButton onClick on Firefox and bar color
- CommonProps usage in ui-framework. SvgPath sample in ui-test-app. Added tools/build/tslint-docs.json.
- Show/Hide UI enhancements. Widget Opacity enhancements.
- Added local snapshot support to ui-test-app. Added specialized div components to ui-core.
- Fix broken links
- Fixed Viewport heights & initial navigation aid. Widget transparency.
- From hackathon-ui-team: StagePanels, UI Show/Hide, PopupButtons
- Put sourcemap in npm package.
- Require React & React-dom 16.8
- Update icons-generic-webfont version to latest available.
- Add TitleBar component for toolsetting instead of using one from footer. Title bas needed to be more compact in toolsettings widget.
- Tool Settings: removed minimize tab, added min to title bar, styled title
- Auto close popups when clicking outside.
- Move zone components to @beta.
- Move tool settings components to @beta.
- Remove popover components.
- Prevent widget content unmount in 9-Zone demo.
- Change start to flex-start to avoid linting warnings from postcss-loader
- Upgrade TypeDoc dependency to 0.14.2

## 0.190.0
Thu, 14 Mar 2019 14:26:49 GMT

### Updates

- Added 'uifw-' to ContentLayout CSS class names and others. Fixed Status Bar separators.
- Added 'uifw-' prefix to most ui-framework CSS class names
- Cleaned up index.scss for variables & mixins in ui-core and added classes.scss that generates CSS

## 0.189.0
Wed, 06 Mar 2019 15:41:22 GMT

### Updates

- UI documentation fixes
- Use new buildIModelJsBuild script
- Remove unneeded typedoc plugin dependency
- Minor UI Color Theme changes
- Support for including CSS files in published UI packages
- Added styling capability ot messages
- Removed dependency on BWC. Parts of BWC copied into ui-core in preparation for theming support.
- Added ToggleEditor. Support for defaultTool in Frontstage.
- Save BUILD_SEMVER to globally accessible map
- Added support for UI color themes
- Display status message above status indicator popup.
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

### Updates

- Add Status Field to show selection count

## 0.185.0
Fri, 11 Jan 2019 18:29:00 GMT

*Version update only*

## 0.184.0
Thu, 10 Jan 2019 22:46:17 GMT

### Updates

- Keyboard Shortcut support
- Ensure unique relative paths in ninezone source.

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

*Version update only*

## 0.179.0
Wed, 19 Dec 2018 18:26:14 GMT

### Updates

- Added showDialogInitially support to ActivityMessageDetails
- Refactor Tooltip component to position over multiple viewports.

## 0.178.0
Thu, 13 Dec 2018 22:06:10 GMT

### Updates

- Migrate from React.Component to React.PureComponent

## 0.177.0
Wed, 12 Dec 2018 17:21:32 GMT

*Version update only*

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

- Created index file to match package name, eliminate subdirectory index files, decrease usage of default exports, some class name changes to avoid conflicts in the index file.

## 0.171.0
Mon, 03 Dec 2018 18:52:58 GMT

### Updates

- Changed Omit typedef source from ui/ninezone to ui/core

## 0.170.0
Mon, 26 Nov 2018 19:38:42 GMT

### Updates

- Changed Omit typedef source from ui/ninezone to ui/core

## 0.169.0
Tue, 20 Nov 2018 16:17:15 GMT

*Version update only*

## 0.168.0
Sat, 17 Nov 2018 14:20:11 GMT

*Version update only*

## 0.167.0
Fri, 16 Nov 2018 21:45:44 GMT

### Updates

- Fixed some content control sizing issues
- Moved most isHidden logic for toolbar items into ui-ninezone
- Hiding items by rendering them conditionally instead of using a CSS class.
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

- Updated to TypeScript 3.1
- fixed height issues with widget content

## 0.163.0
Wed, 31 Oct 2018 20:55:37 GMT

### Updates

- Added JSX specification for Frontstage, Zone & Widget
- Fixed ui-framework unit test

## 0.162.0
Wed, 24 Oct 2018 19:20:07 GMT

### Updates

- Make ToolAdmin.defaultTool. public. Allow getToolTip to return HTMLElement | string.
- Tooltips, ToolAdmin.activeToolChanged support, SheetNavigationAid/SheetsModalFrontstage improvements.
- Ui Documentation
- Vertical PropertyGrid layout improvements. PropertyGrid background color. Setting the widget state.

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

