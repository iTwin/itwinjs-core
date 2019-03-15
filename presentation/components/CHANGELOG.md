# Change Log - @bentley/presentation-components

This log was last generated on Thu, 14 Mar 2019 14:26:49 GMT and should not be manually modified.

## 0.190.0
Thu, 14 Mar 2019 14:26:49 GMT

### Updates

- Fix test scripts for unix systems
- Set `TreeNodeItem.icon` when initializing it from presentation `Node` object

## 0.189.0
Wed, 06 Mar 2019 15:41:22 GMT

### Updates

- Changes package.json to include api-extractor and adds api-extractor.json
- Use new buildIModelJsBuild script
- Exported ContentBuilder and ContentDataProvider
- Remove uneeded typedoc plugin depedency
- Expose presentation-specific content request methods through IContentDataProvider so they're available for provider consumers
- Save BUILD_SEMVER to globally accessible map
- Change `DataProvidersFactory.createSimilarInstancesTableDataProvider` to return data provider that also has a description
- Add DataProvidersFactory API for creating presentation data providers targeted towards specific use cases
- (breaking) Change PresentationTableDataProvider's constructor to accept a props object instead of multiple arguments
- Make all content data providers IDisposable. **Important:** providers must be disposed after use.
- Changed the way `0` selection level is handled in unified selection tables. Previously we used to reload table data when selection changed with level below boundary __or level `0`__. Now the __underlined__ part is removed and we only reload data if selection changes with level below boundary (set through props).
- RPC Interface changes to optimize getting first page of nodes/content
- Move property definitions to imodeljs-frontend so they could be used by tools to define properties for tool settings.
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

- Do not set optional TreeNodeItem properties if values match defaults
- Added interfaces for Property Pane and Table data providers.
- Changed 'connection' property name to 'imodel' in IPropertyDataProvider.
- Removed default exports in presentation-components.

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

- Throttling for withUnifiedSelection(Viewport) - avoid handling intermediate selection changes
- Fix linter warnings

## 0.178.0
Thu, 13 Dec 2018 22:06:10 GMT

*Version update only*

## 0.177.0
Wed, 12 Dec 2018 17:21:31 GMT

### Updates

- Remove `selectionTarget` prop from `withUnifiedSelection(Tree)` - `SelectionTarget.Node` turned out to make no sense, so it got removed. Now the tree always works in `SelectionTarget.Instance` mode.
- Remove `selectedNodes` prop from `withUnifiedSelection(Tree)` - it makes no sense to allow specify selected nodes for a unified selection tree.
- Fix `withUnifiedSelection(Tree)` reloading on selection change to avoid `forceRefresh()` call.
- React to checkbox-related prop renames in ui-components

## 0.176.0
Mon, 10 Dec 2018 21:19:45 GMT

*Version update only*

## 0.175.0
Mon, 10 Dec 2018 17:08:55 GMT

*Version update only*

## 0.174.0
Mon, 10 Dec 2018 13:24:09 GMT

### Updates

- Remove unused dependencies, add `build:watch` script

## 0.173.0
Thu, 06 Dec 2018 22:03:29 GMT

*Version update only*

## 0.172.0
Tue, 04 Dec 2018 17:24:39 GMT

### Updates

- Changed index file name to match package name, eliminate subdirectory index files, decrease usage of default exports, change imports to use other packages' index file.

## 0.171.0
Mon, 03 Dec 2018 18:52:58 GMT

### Updates

- PropertyRecord of type Array now also returns itemsTypeName under value property.

## 0.170.0
Mon, 26 Nov 2018 19:38:42 GMT

### Updates

- PropertyRecord of type Array now also returns itemsTypeName under value property.

## 0.169.0
Tue, 20 Nov 2018 16:17:15 GMT

### Updates

- Rename withFilteringSupport props: onHighlightedCounted -> onMatchesCounted, activeHighlightedIndex -> activeMatchIndex

## 0.168.0
Sat, 17 Nov 2018 14:20:11 GMT

*Version update only*

## 0.167.0
Fri, 16 Nov 2018 21:45:44 GMT

*Version update only*

## 0.166.0
Mon, 12 Nov 2018 16:42:10 GMT

*Version update only*

## 0.165.0
Mon, 12 Nov 2018 15:47:00 GMT

### Updates

- Unified Selection: Fix selection change events being broadcasted indefinitely when multiple unified selection viewports are used

## 0.164.0
Thu, 08 Nov 2018 17:59:21 GMT

### Updates

- Deprecated dev-cors-proxy-server and use of it. 
- Fix filtered tree rendering "0 matches found" when there's no filtering applied and data provider returns 0 nodes
- Updated to TypeScript 3.1
- React to Tree API changes

## 0.163.0
Wed, 31 Oct 2018 20:55:37 GMT

*Version update only*

## 0.162.0
Wed, 24 Oct 2018 19:20:07 GMT

### Updates

- Handle undefined structs and arrays

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

