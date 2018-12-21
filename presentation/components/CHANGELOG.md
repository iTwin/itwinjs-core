# Change Log - @bentley/presentation-components

This log was last generated on Wed, 19 Dec 2018 18:26:14 GMT and should not be manually modified.

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

