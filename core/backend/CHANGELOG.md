# Change Log - @bentley/imodeljs-backend

This log was last generated on Tue, 24 Jul 2018 14:13:01 GMT and should not be manually modified.

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

