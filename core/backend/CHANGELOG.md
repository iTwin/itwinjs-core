# Change Log - @bentley/imodeljs-backend

This log was last generated on Tue, 31 Jul 2018 13:01:51 GMT and should not be manually modified.

## 0.106.0
Tue, 31 Jul 2018 13:01:51 GMT

### Updates

- ChangeSummaryManager.extractChangeSummaries now takes an AccessToken.

## 0.105.0
Tue, 31 Jul 2018 11:36:14 GMT

### Updates

- rename getLocatMessage to getToolTip
- imodeljs-clients is now safe for browser-specific code to import - hide file handler dependencies
- TFS#923316 - JsInterop::InsertLinkTableRelationship should not ignore relationship instance properties supplied by the caller

## 0.104.1
Thu, 26 Jul 2018 21:35:07 GMT

*Version update only*

## 0.104.0
Thu, 26 Jul 2018 18:25:15 GMT

### Updates

- Serialization of SheetViewDefinition includes SheetProps containing both the sheet size and any attachment ids

## 0.103.0
Tue, 24 Jul 2018 15:52:30 GMT

*Version update only*

## 0.102.0
Tue, 24 Jul 2018 14:13:01 GMT

### Updates

- added ToolTips
- remove get/setShow methods on ViewFlags. They were redundant.

## 0.101.0
Mon, 23 Jul 2018 22:00:01 GMT

### Updates

- Added SqliteStatement.isReadonly.
- Added SqliteStatement.ts to default imports of the backend package.
- TFS#917985: Tweaked the internal mechanism when opening a new IModelConnection for better performance. Added more logging to enable the router/provisioner team to potential diagnose performance issues. 

