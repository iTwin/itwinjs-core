# Change Log - @bentley/ui-components

This log was last generated on Mon, 03 Jun 2019 18:09:39 GMT and should not be manually modified.

## 1.0.0
Mon, 03 Jun 2019 18:09:39 GMT

### Updates

- Update to use parse error message from callback.
- Added UI Logger & UiError usage & improved i18n calls
- Added Overflow button support
- Define `extendedData` in `TreeNodeItem` and `RowItem` as a key-value pairs structure. We're about to expose this structure to external consumers and don't want them to set `extendedData` to some primitive value. Instead, consumers should put key-value pairs with keys unique enough to not overwrite others' values.
- Update CustomNumberEditor to show InputFieldMessage when unable to parse quantity.
- Release tag cleanup and ui-framework unit tests
- Updated UI package release tags for 1.0 release.
- Fixed release tag warnings in UI packages
- Add alpha level support for solar timeline
- Added property selection to the property grid component on right click
- Update Tree API. Allow onCheckboxClick callback to receive multiple checkbox state changes.
- Tree: Fix node placeholder offset
- Added ViewSelectorChangedEvent

## 0.191.0
Mon, 13 May 2019 15:52:05 GMT

### Updates

- Update to latest version of icon library.
- @beta tags for Toolbar. More React.PureComponent usage. Added constructors to prevent deprecated warnings. Coverage minimum thresholds.
- #84584 Add support for a view overlay component. This will provide ability to show animation timeline control in viewport.
- Update Timeline interfaces.
- Update CSS for ColorSwatch.
- Add Unit test for ColorEditor and ColorPickerButton
- Added CommonProps to many component Props in ui-core & ui-components
- Added 'Register' link back to SignIn component. Added ExternalIModel test widget. Made AppBackstage in ui-test-app Redux connected again.
- Added missing package prefix to some CSS class names in ui-core, ui-components & ui-framework
- Reverted CubeNavigationAid changes
- Added viewport synchronization for 2d drawing navigation aid
- Added local snapshot support to ui-test-app. Added specialized div components to ui-core.
- Fix broken links
- Fix failing CustomNumberPropertyEditor test
- Add WeightEditor line weight type editor.
- Add components to show and select a line weight.
- Put sourcemap in npm package.
- Locked react-data-grid at 6.0.1 and @types/react-data-grid at 4.0.2
- #96348 Improve default rotate point for navigation cube
- Fix to SignIn constructor in ui-components
- Added SignIn presentational component to ui-components. Removed --ignoreMissingTags extract-api option.
- Require React & React-dom 16.8
- remove IModelApp subclasses
- Added ViewportDialog in ui-test-app, ui-core/ContributeGuidelines.md. TSLint rules in ui-core for no-default-export & completed-docs. @beta release tags.
- Update icons-generic-webfont version to latest available.
- Clean up WeightPickerButton test code.
- Introduce timeline animation interfaces.
- Move timeline components from ui-test-app to ui-components package
- Added release tags to ui-framework, ui-components and ui-core.
- Property Grid: Show loading spinner only after half a second delay
- Fix indefinite Tree component rendering when used with `checkboxInfo` prop
- Tree: Fix nodes not being re-rendered in some async workflows
- Fix tree being marked as dirty when selected nodes predicate changes, but returns the same results (actual selection doesn't change)
- Add Tree.getLoadedNode(nodeId) function
- Add ability to set tooltips on tree node checkboxes
- Unit tests and fixed ColorEditor alignment
- Upgrade TypeDoc dependency to 0.14.2
- Added test coverage for ViewportComponent

## 0.190.0
Thu, 14 Mar 2019 14:26:49 GMT

### Updates

- Add ColorEditor to list of available Type Editors
- Cleaned up index.scss for variables & mixins in ui-core and added classes.scss that generates CSS
- Add SaturationPicker for use with ColorType editor.
- Add Transparency slider component.

## 0.189.0
Wed, 06 Mar 2019 15:41:22 GMT

### Updates

- UI documentation fixes
- Added ToggleEditor. Support for defaultTool in Frontstage. Fixed BooleanEditor sizing.
- Added 100% test coverage for Breadcrumb/BreadcrumbDetails
- Use new buildIModelJsBuild script
- Remove unneeded typedoc plugin dependency
- Added EnumEditor & BooleanEditor type editors
- Minor UI Color Theme changes
- Support for including CSS files in published UI packages
- Updated type editors to support updated PropertyRecord. Moved setFocus to props in type editors..
- Removed dependency on BWC. Parts of BWC copied into ui-core in preparation for theming support.
- Added ToggleEditor. Support for defaultTool in Frontstage.
- Save BUILD_SEMVER to globally accessible map
- Change setImmediate to setTimeout. Fixed cube rotation issue.
- Added ItemStyle and ItemStyle provider.
- CellItem and TreeNodeItem now have the same style property.
- Added TableCell and TableCellContent React components.
- Changed table css class names.
- Changed CellItem interface property - 'alignment' type to be a restricted string instead of an enum.
-  Cleanup of DefaultToolSetting provider and EnumButtonGroup editor
- Add EnumButtonGroupEditor.
- Primitive property value renderers now render links specified in property records.
- Renamed class names that start with "ui-components-" to start with just "components-"
- Added IImageLoader, ImageRenderer and TreeImageLoader.
- Added showIcons and imageLoader props to Tree component.
- Added a property to provide rowHeight value or function that calculates it.
- Tree now accepts one checkbox prop object instead of multiple props.
- Tree now accepts one cell editing prop object instead of multiple props.
- Split tree node label and description rendering into a separate component - TreeNodeContent.
- Added an ability to show node descriptions in the Tree component via showDescriptions property.
- Fix tree failing to load nodes in special cases
- Added support for UI color themes
- Add a way to specify checkbox states asynchronously in Tree component
- Breadcrumb fixes
- Add a way to specify custom Tree checkbox renderer
- Update to use newer generic-icons-webfont package.
- upgrade to TypeScript 3.2.2
- WIP: ViewportComponent unit tests. Removed imodeljs-clients-backend dependency from ui-framework

## 0.188.0
Wed, 16 Jan 2019 16:36:09 GMT

*Version update only*

## 0.187.0
Tue, 15 Jan 2019 15:18:59 GMT

### Updates

- Add a separate PropertyGrid prop to tell if properties should be hoverable
- Add ability to assign context menu for properties in PropertyGrid

## 0.186.0
Mon, 14 Jan 2019 23:09:10 GMT

### Updates

- Property pane does not show struct or array info anymore

## 0.185.0
Fri, 11 Jan 2019 18:29:00 GMT

*Version update only*

## 0.184.0
Thu, 10 Jan 2019 22:46:17 GMT

### Updates

- Renamed PropertyDataProvider to IPropertyDataProvider.
- Add ui-component root to avoid relative file conflicts in bundles.
- Handle custom row and cell item styling in Table component
- Fix double and navigation property value renderers to not append ".0" to values in certain cases

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

- Changed property pane css.
-  Changed how vertical PropertyPane looks.
- Fix BeInspireTree's render suspension not being consistent in some cases
- Added optional viewState prop to ViewportComponent

## 0.179.0
Wed, 19 Dec 2018 18:26:14 GMT

### Updates

- Added Tests, updated Table, fixed breadcrumb mutability issues
- Added DragDrop tests, added component withDragDrop HOC tests
- Synchronizing navigation aids with view definition changes
- Simplified property pane tooltips and improved Property Pane performance.
- Simplified struct and array tooltips in Table component. 
- Fix BeInspireTree's event listening functions to handle array inputs
- Fix BeInspireTree's muting events with allowed number of triggers
- Cache BeInspireTree.visible() result for better performance
- Optimize BeInspireTree.selectBetween
- Avoid loading PropertyGrid data for intermediate data changes
- Avoid loading TableView data for intermediate column / row changes
- Allow property converters and renderers to return result either sync or async
- Fix tree node loosing its children when collapsed while children are being loaded
- Fix tree not showing data after changing data provider while another data provider is being loaded
- Show loading spinner in the Tree while root nodes are being loaded

## 0.178.0
Thu, 13 Dec 2018 22:06:10 GMT

*Version update only*

## 0.177.0
Wed, 12 Dec 2018 17:21:32 GMT

### Updates

- Added a merged property value renderer.
- Set BeInspireTreeNode's payload as possibly `undefined`
- Fix Tree component to handle data provider change before the first update
- Handle shift-selecting not loaded tree nodes
- Fix tree checkbox-related props
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

- Added Tests, updated Table, fixed breadcrumb mutability issues
- Tree now accepts propertyValueRendererManager as a property.
- PrimitivePropertyValueRenderer now accepts context and can render tree properties.
- TreeNodeItem now accepts an additional optional property - typename.
- TreeNode can now render asynchronously.

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

- Added tests to Breadcrumb, updated Table and fixed Table Resize issues.
- Added property value renderers for double and navigation primitive types.
- Added specialized property value renderers for nonprimitive types when their container is a table.
- Refactored PropertyRenderer into smaller pieces and added isSelectable and indentation prop
- Changed the way PropertyCategoryBlock looks.
- Enabled table to contain popups and dialog and slightly cleaned up it's CSS.
- Unit tests
- Removed ConfigurableUiManager.addFrontstageDef and other unused/old methods and components
- Implement pagination in Tree component

## 0.170.0
Mon, 26 Nov 2018 19:38:42 GMT

### Updates

- Added property value renderers for double and navigation primitive types.
- Added specialized property value renderers for nonprimitive types when their container is a table.
- Refactored PropertyRenderer into smaller pieces and added isSelectable and indentation prop
- Changed the way PropertyCategoryBlock looks.
- Enabled table to contain popups and dialog and slightly cleaned up it's CSS.

## 0.169.0
Tue, 20 Nov 2018 16:17:15 GMT

### Updates

- Virtualized nodes' rendering in the Tree component

## 0.168.0
Sat, 17 Nov 2018 14:20:11 GMT

*Version update only*

## 0.167.0
Fri, 16 Nov 2018 21:45:44 GMT

### Updates

- Fixed some content control sizing issues
- Added Tree cell editing
- Added ShowHide in Common package, implemented ShowHide for Table columns.
- Tree cell editing unit tests
- Fix tree nodes loosing their state when ITreeDataProvider.onTreeNodeChanged is called
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

- Deprecated dev-cors-proxy-server and use of it. 
- Fix: Do not start search if input field is empty
- Use strongly typed enums for identifying keyboard keys
- PropertyGrid property editing and unit tests
- Updated to TypeScript 3.1
- Refactored Tree component to improve its performance
- Refactored Breadcrumb and added tests
- Zone & Widget initial state, more ui-core unit tests, cleaned up ui-framework index.ts files.

## 0.163.0
Wed, 31 Oct 2018 20:55:37 GMT

### Updates

- Fixed breadcrumb component test
- Added JSX specification for Frontstage, Zone & Widget
- Fixed ui-framework unit test

## 0.162.0
Wed, 24 Oct 2018 19:20:07 GMT

### Updates

- Tooltips, ToolAdmin.activeToolChanged support, SheetNavigationAid/SheetsModalFrontstage improvements.
- Ui Documentation
- Vertical PropertyGrid layout improvements. PropertyGrid background color. Setting the widget state.
- Changed Horizontal PropertyGrid css to use grid instead of table display and modified subcomponents accordingly.
- Fixed property selection.
- Added an ability to resize label/value in PropertyRenderer.
- SelectablePropertyBlock now controls label/value ratio for every property in a category.
- Fixed PropertyList to use the right key.
- Updated types from any to more specific one in TypeConverters.
- Primitive property record value now can not be undefined.
- TextEditor now accepts property defined as string instead of PropertyRecord.
- Added a manager that allows registering custom property value renderers.
- Added default renderers for Primitive, Array and Struct properties.
- Custom property value renderer manager can now be provided to Table and Pane. Without it they use default property renderers.

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

