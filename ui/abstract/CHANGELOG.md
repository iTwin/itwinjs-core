# Change Log - @bentley/ui-abstract

This log was last generated on Tue, 28 Jul 2020 16:26:24 GMT and should not be manually modified.

## 2.4.0
Tue, 28 Jul 2020 16:26:24 GMT

### Updates

- Add EditorParams for ImageCheckBoxEditor.
- Add RightTop and LeftTop to RelativePosition.

## 2.3.3
Thu, 23 Jul 2020 12:57:15 GMT

*Version update only*

## 2.3.2
Tue, 14 Jul 2020 23:50:36 GMT

*Version update only*

## 2.3.1
Mon, 13 Jul 2020 18:50:14 GMT

*Version update only*

## 2.3.0
Fri, 10 Jul 2020 17:23:14 GMT

### Updates

- Accessibility: Improved focus borders & indicators

## 2.2.1
Tue, 07 Jul 2020 14:44:52 GMT

*Version update only*

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

*Version update only*

## 1.14.0
Tue, 31 Mar 2020 15:44:19 GMT

*Version update only*

## 1.13.0
Wed, 04 Mar 2020 16:16:31 GMT

*Version update only*

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

