# Change Log - @itwin/appui-abstract

This log was last generated on Fri, 26 Aug 2022 15:40:02 GMT and should not be manually modified.

## 3.3.1
Fri, 26 Aug 2022 15:40:02 GMT

_Version update only_

## 3.3.0
Thu, 18 Aug 2022 19:08:01 GMT

### Updates

- upgrade mocha to version 10.0.0
- Do not filter calls to provideBackstageItems by stage criteria set when provider is registered.
- Add hideWithUiWhenFloating prop to widgets so that an app can opt into hiding specific floating widgets when the UI automatically hides.

## 3.2.9
Fri, 26 Aug 2022 14:21:40 GMT

_Version update only_

## 3.2.8
Tue, 09 Aug 2022 15:52:41 GMT

_Version update only_

## 3.2.7
Mon, 01 Aug 2022 13:36:56 GMT

_Version update only_

## 3.2.6
Fri, 15 Jul 2022 19:04:43 GMT

_Version update only_

## 3.2.5
Wed, 13 Jul 2022 15:45:52 GMT

_Version update only_

## 3.2.4
Tue, 21 Jun 2022 18:06:33 GMT

_Version update only_

## 3.2.3
Fri, 17 Jun 2022 15:18:39 GMT

_Version update only_

## 3.2.2
Fri, 10 Jun 2022 16:11:36 GMT

_Version update only_

## 3.2.1
Tue, 07 Jun 2022 15:02:56 GMT

_Version update only_

## 3.2.0
Fri, 20 May 2022 13:10:54 GMT

### Updates

- Implement svg icons loading as a web component.
- Add ability to pass parameters to UiItemsManager when loading items provider to specify what stages allow the provider to supply items.
- Allow React icons to be user on Wedget tabs, backstage, and status bar items.
- Add ability to specify default widget size.

## 3.1.3
Fri, 15 Apr 2022 13:49:25 GMT

_Version update only_

## 3.1.2
Wed, 06 Apr 2022 22:27:56 GMT

_Version update only_

## 3.1.1
Thu, 31 Mar 2022 15:55:48 GMT

_Version update only_

## 3.1.0
Tue, 29 Mar 2022 20:53:46 GMT

### Updates

- Fix missing parameter in UiManager.getWidgets call and pass provider to isSupportedStage function.
- Provide internal method to clear out all registered item providers for use in unit testing.

## 3.0.3
Fri, 25 Mar 2022 15:10:01 GMT

_Version update only_

## 3.0.2
Thu, 10 Mar 2022 21:18:13 GMT

_Version update only_

## 3.0.1
Thu, 24 Feb 2022 15:26:55 GMT

_Version update only_

## 3.0.0
Mon, 24 Jan 2022 14:00:52 GMT

### Updates

- Add onUnregister function to UiItemsProviderInterface to allow provider to do cleanup.
- Upgrade target to ES2019 and deliver both a CommonJs and ESModule version of package
- rename to @itwin/appui-abstract
- remove ClientRequestContext and its subclasses
- Replace usage of I18N with generic Localization interface.
- Remove UiItemsArbiter.
- remove ClientRequestContext.current
- Add non-static class to handle UiSync messages.
- Refactored part of AccuDraw UI & Providing AccuDraw UI documentation
- Create empty frontstage and UiItemsProviders to populate it and update how ContentGroups are defined.
- Deprecate and promote apis
- Deprecate obsolete APIs. Publish beta APIs from last release.
- Deprecate UI 1.0 props
- Add comment about isPressed property.
- Allow widgets supplied by a UiItemsProvider to specify a default state of floating.
- Incorporating iTwinUI-CSS and iTwinUI-React into iModel.js
- Rename ui directories to match new package names.
- Fix bug that sets the icon on MessageBox.NoSymbol the Success icon.
- Update to React 17
- Created imodel-components folder & package and moved color, lineweight, navigationaids, quantity, timeline & viewport. Deprecated MessageSeverity in ui-core & added it ui-abstract. Added MessagePresenter interface to ui-abstract.
- UiFramework and UiIModelComponent initialize method no longer take localization argument, uses IModelApp.localization internally.
- Remove old aribiter related functions that are not used.
- Add BaseUiItemsProvider class
- Replaced ui-core Slider with one from iTwinUi-react. 
- Add support for widget tab icons in UI-2

## 2.19.28
Wed, 12 Jan 2022 14:52:38 GMT

_Version update only_

## 2.19.27
Wed, 05 Jan 2022 20:07:20 GMT

_Version update only_

## 2.19.26
Wed, 08 Dec 2021 20:54:53 GMT

_Version update only_

## 2.19.25
Fri, 03 Dec 2021 20:05:49 GMT

_Version update only_

## 2.19.24
Mon, 29 Nov 2021 18:44:31 GMT

_Version update only_

## 2.19.23
Mon, 22 Nov 2021 20:41:40 GMT

_Version update only_

## 2.19.22
Wed, 17 Nov 2021 01:23:26 GMT

_Version update only_

## 2.19.21
Wed, 10 Nov 2021 10:58:24 GMT

_Version update only_

## 2.19.20
Fri, 29 Oct 2021 16:14:22 GMT

_Version update only_

## 2.19.19
Mon, 25 Oct 2021 16:16:25 GMT

_Version update only_

## 2.19.18
Thu, 21 Oct 2021 20:59:44 GMT

_Version update only_

## 2.19.17
Thu, 14 Oct 2021 21:19:43 GMT

_Version update only_

## 2.19.16
Mon, 11 Oct 2021 17:37:46 GMT

_Version update only_

## 2.19.15
Fri, 08 Oct 2021 16:44:23 GMT

_Version update only_

## 2.19.14
Fri, 01 Oct 2021 13:07:03 GMT

_Version update only_

## 2.19.13
Tue, 21 Sep 2021 21:06:40 GMT

_Version update only_

## 2.19.12
Wed, 15 Sep 2021 18:06:47 GMT

_Version update only_

## 2.19.11
Thu, 09 Sep 2021 21:04:58 GMT

_Version update only_

## 2.19.10
Wed, 08 Sep 2021 14:36:01 GMT

_Version update only_

## 2.19.9
Wed, 25 Aug 2021 15:36:01 GMT

_Version update only_

## 2.19.8
Mon, 23 Aug 2021 13:23:13 GMT

_Version update only_

## 2.19.7
Fri, 20 Aug 2021 17:47:22 GMT

_Version update only_

## 2.19.6
Tue, 17 Aug 2021 20:34:29 GMT

_Version update only_

## 2.19.5
Fri, 13 Aug 2021 21:48:09 GMT

_Version update only_

## 2.19.4
Thu, 12 Aug 2021 13:09:26 GMT

_Version update only_

## 2.19.3
Wed, 04 Aug 2021 20:29:34 GMT

_Version update only_

## 2.19.2
Tue, 03 Aug 2021 18:26:23 GMT

_Version update only_

## 2.19.1
Thu, 29 Jul 2021 20:01:11 GMT

_Version update only_

## 2.19.0
Mon, 26 Jul 2021 12:21:25 GMT

### Updates

- remove internal barrel-import usage
- Stop delivering pseudo-localized strings

## 2.18.4
Tue, 10 Aug 2021 19:35:13 GMT

_Version update only_

## 2.18.3
Wed, 28 Jul 2021 17:16:30 GMT

_Version update only_

## 2.18.2
Mon, 26 Jul 2021 16:18:31 GMT

_Version update only_

## 2.18.1
Fri, 16 Jul 2021 17:45:09 GMT

_Version update only_

## 2.18.0
Fri, 09 Jul 2021 18:11:24 GMT

### Updates

- Add new helper method PropertyDescriptionHelper.buildLockPropertyDescription.
- Add ability to provide widgets to zones via UiItemsProvider when using AppUI version 1.

## 2.17.3
Mon, 26 Jul 2021 16:08:36 GMT

_Version update only_

## 2.17.2
Thu, 08 Jul 2021 15:23:00 GMT

_Version update only_

## 2.17.1
Fri, 02 Jul 2021 15:38:31 GMT

_Version update only_

## 2.17.0
Mon, 28 Jun 2021 16:20:11 GMT

### Updates

- Add beta tag to canPopout property.
- Publish in-use APIs

## 2.16.10
Thu, 22 Jul 2021 20:23:45 GMT

_Version update only_

## 2.16.9
Tue, 06 Jul 2021 22:08:34 GMT

_Version update only_

## 2.16.8
Fri, 02 Jul 2021 17:40:46 GMT

_Version update only_

## 2.16.7
Mon, 28 Jun 2021 18:13:04 GMT

_Version update only_

## 2.16.6
Mon, 28 Jun 2021 13:12:55 GMT

_Version update only_

## 2.16.5
Fri, 25 Jun 2021 16:03:01 GMT

_Version update only_

## 2.16.4
Wed, 23 Jun 2021 17:09:07 GMT

_Version update only_

## 2.16.3
Wed, 16 Jun 2021 20:29:32 GMT

_Version update only_

## 2.16.2
Thu, 03 Jun 2021 18:08:11 GMT

_Version update only_

## 2.16.1
Thu, 27 May 2021 20:04:22 GMT

_Version update only_

## 2.16.0
Mon, 24 May 2021 15:58:39 GMT

### Updates

- Adding ability to override isActive property for BackstageItem
- Add `PropertyDescription.hideCompositePropertyLabel` flag to tell the renderers to not render array/struct property labels.

## 2.15.6
Wed, 26 May 2021 15:55:19 GMT

_Version update only_

## 2.15.5
Thu, 20 May 2021 15:06:26 GMT

_Version update only_

## 2.15.4
Tue, 18 May 2021 21:59:07 GMT

_Version update only_

## 2.15.3
Mon, 17 May 2021 13:31:38 GMT

_Version update only_

## 2.15.2
Wed, 12 May 2021 18:08:13 GMT

_Version update only_

## 2.15.1
Wed, 05 May 2021 13:18:31 GMT

_Version update only_

## 2.15.0
Fri, 30 Apr 2021 12:36:58 GMT

### Updates

- Add PropertyDescriptionHelper.buildNumberEditorDescription method
- Publish APIs used by iTwinViewer.

## 2.14.4
Thu, 22 Apr 2021 21:07:33 GMT

_Version update only_

## 2.14.3
Thu, 15 Apr 2021 15:13:16 GMT

_Version update only_

## 2.14.2
Thu, 08 Apr 2021 14:30:09 GMT

_Version update only_

## 2.14.1
Mon, 05 Apr 2021 16:28:00 GMT

_Version update only_

## 2.14.0
Fri, 02 Apr 2021 13:18:42 GMT

### Updates

- Added `StandardTypeName.URL`.
- Changed `LinkElementsInfo.onClick` to be mandatory.
- Support for Bump Tool Settings

## 2.13.0
Tue, 09 Mar 2021 20:28:13 GMT

### Updates

- Fixed broken double angle bracket link syntax
- Updated to use TypeScript 4.1
- begin rename project from iModel.js to iTwin.js

## 2.12.3
Mon, 08 Mar 2021 15:32:00 GMT

_Version update only_

## 2.12.2
Wed, 03 Mar 2021 18:48:53 GMT

_Version update only_

## 2.12.1
Tue, 23 Feb 2021 20:54:45 GMT

_Version update only_

## 2.12.0
Thu, 18 Feb 2021 22:10:13 GMT

### Updates

- AccuDraw bi-directional value updates
- Correctly handle capitalized SyncEventIds.

## 2.11.2
Thu, 18 Feb 2021 02:50:59 GMT

_Version update only_

## 2.11.1
Thu, 04 Feb 2021 17:22:41 GMT

_Version update only_

## 2.11.0
Thu, 28 Jan 2021 13:39:27 GMT

### Updates

- Add InstanceKey type description
- Initial implementation of AccuDraw UI
- Updated UI Learning docs

## 2.10.3
Fri, 08 Jan 2021 18:34:03 GMT

_Version update only_

## 2.10.2
Fri, 08 Jan 2021 14:52:02 GMT

_Version update only_

## 2.10.1
Tue, 22 Dec 2020 00:53:38 GMT

_Version update only_

## 2.10.0
Fri, 18 Dec 2020 18:24:01 GMT

### Updates

- Refactor DialogItem and Property interfaces to make them easier to use.

## 2.9.9
Sun, 13 Dec 2020 19:00:03 GMT

_Version update only_

## 2.9.8
Fri, 11 Dec 2020 02:57:36 GMT

_Version update only_

## 2.9.7
Wed, 09 Dec 2020 20:58:23 GMT

_Version update only_

## 2.9.6
Mon, 07 Dec 2020 18:40:48 GMT

_Version update only_

## 2.9.5
Sat, 05 Dec 2020 01:55:56 GMT

_Version update only_

## 2.9.4
Wed, 02 Dec 2020 20:55:40 GMT

_Version update only_

## 2.9.3
Mon, 23 Nov 2020 20:57:56 GMT

_Version update only_

## 2.9.2
Mon, 23 Nov 2020 15:33:50 GMT

_Version update only_

## 2.9.1
Thu, 19 Nov 2020 17:03:42 GMT

_Version update only_

## 2.9.0
Wed, 18 Nov 2020 16:01:50 GMT

### Updates

- doc updates
- Combine UiDataProvider and DialogItemManager concepts.

## 2.8.1
Tue, 03 Nov 2020 00:33:56 GMT

_Version update only_

## 2.8.0
Fri, 23 Oct 2020 17:04:02 GMT

### Updates

- Add definitions used to define DateTime component options.
- Added jsdoc ESLint rule for UI packages

## 2.7.6
Wed, 11 Nov 2020 16:28:23 GMT

_Version update only_

## 2.7.5
Fri, 23 Oct 2020 16:23:50 GMT

_Version update only_

## 2.7.4
Mon, 19 Oct 2020 17:57:02 GMT

_Version update only_

## 2.7.3
Wed, 14 Oct 2020 17:00:59 GMT

_Version update only_

## 2.7.2
Tue, 13 Oct 2020 18:20:39 GMT

_Version update only_

## 2.7.1
Thu, 08 Oct 2020 13:04:35 GMT

_Version update only_

## 2.7.0
Fri, 02 Oct 2020 18:03:32 GMT

### Updates

- Add ability to specify different property renderers for property grid.

## 2.6.5
Sat, 26 Sep 2020 16:06:34 GMT

_Version update only_

## 2.6.4
Tue, 22 Sep 2020 17:40:07 GMT

_Version update only_

## 2.6.3
Mon, 21 Sep 2020 14:47:10 GMT

_Version update only_

## 2.6.2
Mon, 21 Sep 2020 13:07:44 GMT

_Version update only_

## 2.6.1
Fri, 18 Sep 2020 13:15:09 GMT

_Version update only_

## 2.6.0
Thu, 17 Sep 2020 13:16:12 GMT

### Updates

- Add support for a feature flag to control the display of the keyin palette.
- Added ConditionalStringValue type to ui-abstract CommonItemProps & AbstractMenuItemProps fields
- Added PopupContextMenu component. Added 'iconRight' support to menu items.
- Moved ESLint configuration to a plugin
- Addressed ESLint warnings in UI packages. Fixed react-set-state-usage rule. Allowing PascalCase for functions in UI packages for React function component names.
- Add support for opening a key-in palette to run key-ins.
- Fix PropertyRecord.copyWithNewValue not copying all attributes from source
- Added new getChildrenRecords method to PropertyRecord class.
- Add event processing for apps to send messages to the UI components.
- Add ThemedEnumEditor for DialogItems and ToolSettings.

## 2.5.5
Wed, 02 Sep 2020 17:42:23 GMT

_Version update only_

## 2.5.4
Fri, 28 Aug 2020 15:34:15 GMT

_Version update only_

## 2.5.3
Wed, 26 Aug 2020 11:46:00 GMT

_Version update only_

## 2.5.2
Tue, 25 Aug 2020 22:09:08 GMT

_Version update only_

## 2.5.1
Mon, 24 Aug 2020 18:13:04 GMT

_Version update only_

## 2.5.0
Thu, 20 Aug 2020 20:57:10 GMT

### Updates

- Update EnumerationChoicesInfo to use Promise so enum choices can be defined asynchronously.
- Moved SpecialKey & FunctionKey enums to ui-abstract & started using them throughout UI packages
- Added Table component keyboard row selection. Miscellaneous a11y fixes.
- Switch to ESLint
- Added Home focus support to ui-abstract

## 2.4.2
Fri, 14 Aug 2020 16:34:09 GMT

_Version update only_

## 2.4.1
Fri, 07 Aug 2020 19:57:43 GMT

_Version update only_

## 2.4.0
Tue, 28 Jul 2020 16:26:24 GMT

### Updates

- Add EditorParams for ImageCheckBoxEditor.
- Add RightTop and LeftTop to RelativePosition.

## 2.3.3
Thu, 23 Jul 2020 12:57:15 GMT

_Version update only_

## 2.3.2
Tue, 14 Jul 2020 23:50:36 GMT

_Version update only_

## 2.3.1
Mon, 13 Jul 2020 18:50:14 GMT

_Version update only_

## 2.3.0
Fri, 10 Jul 2020 17:23:14 GMT

### Updates

- Accessibility: Improved focus borders & indicators

## 2.2.1
Tue, 07 Jul 2020 14:44:52 GMT

_Version update only_

## 2.2.0
Fri, 19 Jun 2020 14:10:03 GMT

### Updates

- Update to use a string in place of StageUsage to make it consistent with other methods.
- Added property editors for multi-line text, slider and numeric input/spinner.
- Replace 'Plugin' with 'Extension' in comments and examples.
- Added support for popup with multiple editors

## 2.1.0
Thu, 28 May 2020 22:48:59 GMT

### Updates

- Added ability for apps to display Favorite properties in Element Tooltip & Card at Cursor

## 2.0.0
Wed, 06 May 2020 13:17:49 GMT

### Updates

- Add support for groupPriority for ToolbarItems. If specified then a group separator is shown when the priority changes.
- Plugins: Update API for app/plugin negotiation at load time.
- Add ConditionStringValue support. Used to define labels and icons.
- update icon package version
- Update GroupButton definition to use ReadonlyArray for child items.
- Documentation fixes
- Slider component tooltipBelow prop & tooltip styling
-  Updates to remove need for svg-sprite-loader, use defualt CRA svgr loader instead.
- Upgrade to Rush 5.23.2
- Rename CustomDefinition to CustomButtonDefinition,
- Learning docs for UiAdmin & UiItemsArbiter
- Promoted some @beta to @public in Ui packages & ToolAssistance for 2.0 release.
- Added `PropertyRecord.fromString()`
- In source documentation. Some learning docs & API changes.
- TOC for UI 2.0 Docs, @alpha to @beta, Components Examples
- Started ui-components Learning doc section
- Update doc tags for automatic UI creation 
- Refactor to remove duplicate ComponentGenerator instantiation. Rename files and components to remove React reference.
- Update auto-generated dialog items to work with the Tool Settings Bar.
- Add ConditionalBoolean support for isHidden and isDisabled properties.
- Moved Property classes and interface from frontend package. Added generic "DialogItemManager" to generate UI based on data from an app.
- Create a BaseDialogItem so that a lock toggle associated with another tool settings or dialog item does not require unnecessary members such as EditorPosition.
- Refactor DefaultToolSettingsProvider to use the DialogItem interfaces in place of ToolSettings classes.
- Defaulting to IModelApp.i18n in UI packages and cascading initialize() calls
- Remove support for the iModel.js module system by no longer delivering modules.

## 1.14.1
Wed, 22 Apr 2020 19:04:00 GMT

_Version update only_

## 1.14.0
Tue, 31 Mar 2020 15:44:19 GMT

_Version update only_

## 1.13.0
Wed, 04 Mar 2020 16:16:31 GMT

_Version update only_

## 1.12.0
Wed, 12 Feb 2020 17:45:50 GMT

### Updates

- Upgraded icons-generic-webfont to ^1.0.0
- Added UiAdmin.showHTMLElement to show information & graphics for markers

## 1.11.0
Wed, 22 Jan 2020 19:24:12 GMT

### Updates

- Upgrade to TypeScript 3.7.2.

## 1.10.0
Tue, 07 Jan 2020 19:44:01 GMT

### Updates

- Add PluginUiManager, PluginUiProvider, BackstageItemManager, BackstageItem, PluginStatusBarManager and abstract statusbar item interfaces.
- Remove duplicate StatusBarItemManager from ui-framework and only leave the one in ui-abstract.

## 1.9.0
Tue, 10 Dec 2019 18:08:56 GMT

### Updates

- Disallow plugins from adding tools anywhere but the end of a toolbar.
- Update sinon version.

## 1.8.0
Fri, 22 Nov 2019 14:03:34 GMT

### Updates

- Update Icon package version
- Added StatusBarComposer, StatusBarItem, StatusBarManager and StatusBarItemsManager
- Added tslint-react-hooks to UI packages

## 1.7.0
Fri, 01 Nov 2019 13:28:37 GMT

### Updates

- UiAdmin methods for AccuDraw Ui: MenuButton, Calculator, Angle, Length, Height
- Added badge support to context menu items. Moved some Plugin Ui definitions to ui-abstract.
- Added initial ui-abstract package setup
- Added UiAdmin with support for displaying Menus and Toolbars at a location

