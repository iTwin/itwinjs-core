# Change Log - @bentley/ui-ninezone

This log was last generated on Wed, 04 Mar 2020 16:16:31 GMT and should not be manually modified.

## 1.13.0
Wed, 04 Mar 2020 16:16:31 GMT

### Updates

- Fix safe area insets for bottom zones w/o footer.

## 1.12.0
Wed, 12 Feb 2020 17:45:50 GMT

### Updates

- Upgraded icons-generic-webfont to ^1.0.0

## 1.11.0
Wed, 22 Jan 2020 19:24:12 GMT

### Updates

- Upgrade to TypeScript 3.7.2.
- Docked tool settings component.

## 1.10.0
Tue, 07 Jan 2020 19:44:01 GMT

### Updates

- Fix widget target infinite set state issue.
- Add css option to pad between icon and label in Label StatusBar Indicator.

## 1.9.0
Tue, 10 Dec 2019 18:08:56 GMT

### Updates

- Invoke onTargetChanged when component unmounts.
- No longer accessing this.state or this.props in setState updater - flagged by lgtm report
- Update sinon version.
- Added support for NotifyMessageDetails.displayTime for Toast messages
- Ability to determine available tool settings width.
- Fix code analysis report issues.
- Use exhaustive-deps linter rule.
- Expandable group touch support.
- Use typescript as webpack configuration language.
- Ability to set zone width from zones manager.
- Removed unused React state variables. Removed unsupported setState calls from render() methods.
- Added ConditionalField and FooterModeField components. StatusBar responsive changes.

## 1.8.0
Fri, 22 Nov 2019 14:03:34 GMT

### Updates

- Update Icon package version.
- Tablet responsive UI
- Added StatusBarComposer, StatusBarItem, StatusBarManager and StatusBarItemsManager
- Added tslint-react-hooks to UI packages
- Remove unsupported fit-content CSS value.
- Fix flex CSS rule shorthand issue in stage panel splitter.
- Touch support for widget drag, widget resize and stage panel splitter.
- Add disabled resize handles option to widget.
- Deprecate history tray components.
- Open tool panel via drag interaction.

## 1.7.0
Fri, 01 Nov 2019 13:28:37 GMT

### Updates

- Fixed mouse interaction for Navigation Aids
- Made the Status Bar & Backstage more responsive on smaller screens
- Added initial ui-abstract package setup
- Added UiAdmin with support for displaying Menus and Toolbars at a location
- Merge zone to save window resize settings and update target zone bounds.
- Fix footer offset in widget mode.
- Enable pointer events over toolbar instead of toolbar container.
- Persist zones layout on window resize.
- Fix Safari high CPU issue.

## 1.6.0
Wed, 09 Oct 2019 20:28:43 GMT

### Updates

- Added AutoSuggest component and improved KeyinBrowser component
- Ability to drag and resize tool settings widget.
- Change prop type from RefObject<T> to T.

## 1.5.0
Mon, 30 Sep 2019 22:28:48 GMT

### Updates

- copyright headers
- Tool Assistance changes per UX Design
- Tool Assistance for Ctrl+Z and other chars
- upgrade to TypeScript 3.6.2
- Prevent BackstageItem label overflow.
- Make components aware of safe area insets.
- Enable backstage scrolling.
- Scrollable tool settings content.

## 1.4.0
Tue, 10 Sep 2019 12:09:49 GMT

### Updates

- #165662. Allow an app to specify touch-specific instructions in tool assistance.

## 1.3.0
Tue, 13 Aug 2019 20:25:53 GMT

### Updates

- Update to use latest icon library
- Add support for BackstageComposer so Plugins can add backstage items.
- Added CursorPrompt, improved Pointer messages
- #159907. Fixed Group Button history is overlapping a Popup Button panel when hovering over the Group button
- Updated generic icon package
- Moved Point, PointProps, Rectangle, RectangleProps, Size and SizeProps to ui-core from ui-ninezone
- Improved ToolAssistance item spacing. ViewSelector shows current view.
- Update to latest icon package version.

## 1.2.0
Wed, 24 Jul 2019 11:47:26 GMT

### Updates

- Move zonesBounds from manager to props.
- Update horizontal toolbar styles
- Update <img> height/width for toolbar items so svg icons would display.
- Added ToolAssistance support and Tool.iconSpec
- Demo changes.
- Refactor and test ZonesManager.

## 1.1.0
Mon, 01 Jul 2019 19:04:29 GMT

### Updates

- Added beta badge support to toolbar buttons and widget tabs
- Resolved tslint issue with ui-ninezone demo
- Removed missing group descriptions
- Update to TypeScript 3.5
- Add stage panel support.

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

