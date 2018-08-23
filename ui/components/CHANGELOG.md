# Change Log - @bentley/ui-components

This log was last generated on Thu, 23 Aug 2018 20:51:32 GMT and should not be manually modified.

## 0.120.0
Thu, 23 Aug 2018 20:51:32 GMT

*Version update only*

## 0.119.0
Thu, 23 Aug 2018 15:25:49 GMT

### Updates

- Changed Tree, Table, and Breadcrumb to use Drag/Drop only when needed.
- Bugfix for: uncaught Promise rejection when spamming viewport selection

## 0.118.0
Tue, 21 Aug 2018 17:20:41 GMT

### Updates

- Added DragDrop API
- Fix PropertyGrid not updating after data provider is changed
- TSLint New Rule Enforcements
- Updated to use TypeScript 3.0

## 0.117.0
Wed, 15 Aug 2018 17:08:54 GMT

*Version update only*

## 0.116.0
Wed, 15 Aug 2018 15:13:19 GMT

*Version update only*

## 0.115.0
Tue, 14 Aug 2018 15:21:27 GMT

*Version update only*

## 0.114.0
Tue, 14 Aug 2018 12:04:18 GMT

*Version update only*

## 0.113.0
Fri, 10 Aug 2018 05:06:20 GMT

*Version update only*

## 0.112.0
Tue, 07 Aug 2018 12:19:22 GMT

*Version update only*

## 0.111.0
Mon, 06 Aug 2018 19:25:38 GMT

*Version update only*

## 0.110.0
Thu, 02 Aug 2018 14:48:42 GMT

*Version update only*

## 0.109.0
Thu, 02 Aug 2018 09:07:03 GMT

*Version update only*

## 0.108.0
Wed, 01 Aug 2018 14:24:06 GMT

### Updates

- Updated to use TypeScript 2.9

## 0.107.0
Tue, 31 Jul 2018 16:29:14 GMT

*Version update only*

## 0.106.0
Tue, 31 Jul 2018 13:01:51 GMT

*Version update only*

## 0.105.0
Tue, 31 Jul 2018 11:36:14 GMT

*Version update only*

## 0.104.1
Thu, 26 Jul 2018 21:35:07 GMT

### Updates

- Added ~ to @import of @bentley/bwc/lib/mixins for webpack

## 0.104.0
Thu, 26 Jul 2018 18:25:15 GMT

*Version update only*

## 0.3.10
Wed, 18 Jul 2018 04:53:37 GMT

### Patches

- Update imodeljs-core dependencies to 0.98.0-4

## 0.3.9
Fri, 13 Jul 2018 18:40:08 GMT

*Version update only*

## 0.3.8
Fri, 13 Jul 2018 13:13:53 GMT

### Patches

- Added documentation, fixed bugs

## 0.3.7
Fri, 13 Jul 2018 10:14:39 GMT

### Patches

- Fix `classnames` dependency

## 0.3.6
Thu, 12 Jul 2018 18:45:50 GMT

### Patches

- Initial pass at imodeljs-ui package and API documentation

## 0.3.5
Wed, 11 Jul 2018 11:52:45 GMT

### Patches

- Added shouldComponentUpdate to DataTree

## 0.3.4
Mon, 09 Jul 2018 20:38:01 GMT

### Patches

- Moved imodeljs-clients to ^7

## 0.3.3
Mon, 09 Jul 2018 20:15:33 GMT

### Patches

- Moved to BWC 6.0.1

## 0.3.2
Mon, 09 Jul 2018 18:00:54 GMT

### Patches

- Moved to BWC 6.0.1

## 0.3.1
Mon, 09 Jul 2018 14:04:45 GMT

### Patches

- Upgrade to imodeljs-frontend 0.96.4

## 0.3.0
Mon, 09 Jul 2018 08:55:22 GMT

### Minor changes

- Added SimpleTreeDataProvider, PageOptions.

## 0.2.14
Thu, 28 Jun 2018 19:57:47 GMT

### Patches

- Changes required by @types/react 16.4.3. Locked @types/enzyme to 3.1.9 because of problems with 3.1.11.

## 0.2.13
Wed, 27 Jun 2018 17:42:10 GMT

### Patches

- Added synchronization between Viewport and CubeNavigationAid

## 0.2.12
Fri, 22 Jun 2018 17:52:32 GMT

### Patches

- Added ContextMenu, RadialMenu & Splitbutton to ui-core. Added Breadcrumb to ui-components.
- Updated imodeljs-frontend to 0.95.1 & geometry-core to 9.1. Experimental code in ViewportComponent for cube/viewport synchronization.

## 0.2.11
Fri, 22 Jun 2018 09:13:41 GMT

### Patches

- Update package dependencies

## 0.2.10
Wed, 20 Jun 2018 15:53:33 GMT

### Patches

- Renamed Viewport in ui-components to ViewportComponent. WIP: view rotation synchronization.

## 0.2.9
Wed, 20 Jun 2018 15:49:05 GMT

### Patches

- Renamed Viewport in ui-components to ViewportComponent. WIP: view rotation synchronization.

## 0.2.8
Wed, 20 Jun 2018 12:23:51 GMT

### Patches

- Update imodeljs-frontend dependency to 0.94

## 0.2.7
Wed, 20 Jun 2018 07:06:26 GMT

### Patches

- Fix nodes setting nodes selection state when expanding their parent

## 0.2.6
Tue, 19 Jun 2018 17:49:17 GMT

### Patches

- Added ViewportManager with Rotation and ActiveViewport support. Moved UiEvent to ui-core. Added ContentViewManager with ActiveContent support & highlighting.

## 0.2.5
Tue, 19 Jun 2018 13:09:17 GMT

### Patches

- Set canvas width and height to 100% to make it fill its parent

## 0.2.4
Tue, 19 Jun 2018 11:08:40 GMT

### Patches

- Add a viewport component

## 0.2.3
Fri, 15 Jun 2018 19:15:02 GMT

### Patches

- Fixed PropertyGrid property rendering.

## 0.2.2
Wed, 13 Jun 2018 20:28:35 GMT

### Patches

- Fixed publishing of public folders

## 0.2.1
Wed, 13 Jun 2018 18:46:23 GMT

### Patches

- SampleApp is using configurableui from ui-framework. AppUi has been added to SampleApp.

## 0.2.0
Wed, 13 Jun 2018 08:50:02 GMT

### Minor changes

- [Tree] Multi-selection support: tree can show multiple selected nodes, but user can select only one at a time (for now)
- [Tree] Do not fire `deselected`+`selected` events when changing selection. Instead, just fire one `selected` event with `replace` flag
- [Tree] Allow consumers to describe selected nodes either with an array of node ids, or a callback function which receives a node
- [TableDataProvider] Add two events: onColumnsChanged and onRowsChanged. Controls that use this provider should reload columns/rows on these events
- [Table] More type-safety

### Patches

- [Tree] Keep expanded nodes when tree is reloaded due to props change
- [Tree] Fix state being set after data arrives asynchronously when component is already unmounted
- [Table] Add 3 additional optional Props callbacks: isRowSelected, onRowsSelected, onRowsDeselected
- [PropertyGrid] Keep category blocks open after props change if they were previously open.
- [PropertyGrid] Fix state being set after data arrives asynchronously when control is already unmounted.
- [PropertyGrid] Fix property data not updated after props change.

## 0.1.5
Fri, 08 Jun 2018 14:15:13 GMT

### Patches

- Add PropertyDataProvider.onDataChanged event to be fired when controls should re-request fresh data

## 0.1.4
Fri, 08 Jun 2018 10:47:30 GMT

### Patches

- Expose node selection change callbacks through DataTree Props

## 0.1.3
Thu, 07 Jun 2018 16:35:47 GMT

*Version update only*

## 0.1.2
Tue, 05 Jun 2018 19:35:37 GMT

### Patches

- Fixed SimpleTableDataProvider.sortRows for PropertyValueFormat.Primitive

