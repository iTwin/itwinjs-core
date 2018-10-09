# Change Log - @bentley/imodeljs-backend

This log was last generated on Tue, 09 Oct 2018 12:08:40 GMT and should not be manually modified.

## 0.153.0
Tue, 09 Oct 2018 12:08:40 GMT

*Version update only*

## 0.152.0
Fri, 05 Oct 2018 21:52:26 GMT

### Updates

- IModelError now requires the message parameter

## 0.151.0
Thu, 04 Oct 2018 21:10:57 GMT

*Version update only*

## 0.150.0
Thu, 04 Oct 2018 21:06:01 GMT

### Updates

- Add IModelJsFs.appendFileSync
- Add Write methods
- Add README.md
- docs
- Spread various geometry classes to smaller files
- Updating copyrights
- Added configuration system to imodeljs and removed urls/credentials
- Mark test as integeration that were not marked but access imodelhub

## 0.148.0
Wed, 03 Oct 2018 17:00:37 GMT

### Updates

- Add IModelJsFs.appendFileSync
- Add README.md
- Spread various geometry classes to smaller files

## 0.147.0
Tue, 02 Oct 2018 19:41:32 GMT

### Updates

- Add README.md

## 0.146.0
Tue, 02 Oct 2018 14:51:50 GMT

### Updates

- Fix for an issue with strict iModelHub Types

## 0.145.0
Tue, 02 Oct 2018 01:02:27 GMT

*Version update only*

## 0.144.0
Mon, 01 Oct 2018 22:10:58 GMT

*Version update only*

## 0.143.0
Mon, 01 Oct 2018 19:10:45 GMT

### Updates

- Changed some iModelHub types to be stricter

## 0.142.0
Mon, 01 Oct 2018 10:28:46 GMT

*Version update only*

## 0.141.0
Fri, 28 Sep 2018 22:27:44 GMT

### Updates

- 0.140.0

## 0.140.0
Fri, 28 Sep 2018 21:04:21 GMT

### Updates

- Version 0.139.0

## 0.139.0
Fri, 28 Sep 2018 19:37:10 GMT

### Updates

- Include the license for the iModel.js native module
- Fixed assertion that prevented opening of iModels with no ChangeSet-s. 

## 0.138.0
Fri, 28 Sep 2018 17:15:55 GMT

*Version update only*

## 0.137.0
Fri, 28 Sep 2018 00:57:48 GMT

### Updates

- docs

## 0.136.0
Thu, 27 Sep 2018 15:02:44 GMT

*Version update only*

## 0.135.0
Wed, 26 Sep 2018 19:16:30 GMT

*Version update only*

## 0.134.0
Wed, 26 Sep 2018 00:50:11 GMT

### Updates

- Add insertAspect and deleteAspect methods

## 0.133.0
Tue, 25 Sep 2018 16:41:00 GMT

### Updates

- Add ability to query iModel's default view ID.

## 0.132.0
Mon, 24 Sep 2018 18:55:46 GMT

### Updates

- Support center snap as part of multi-snap when interiors aren't pickable (open path or wireframe view)

## 0.131.0
Sun, 23 Sep 2018 17:07:30 GMT

*Version update only*

## 0.130.0
Sun, 23 Sep 2018 01:19:16 GMT

*Version update only*

## 0.129.0
Fri, 21 Sep 2018 23:16:13 GMT

### Updates

- Add initial support for the Generic domain.
- Got rid of RpcInvocation.current.context - use ActivityLoggingContext.current instead
- Add more links to learning articles

## 0.128.0
Fri, 14 Sep 2018 17:08:05 GMT

*Version update only*

## 0.127.0
Thu, 13 Sep 2018 17:07:11 GMT

*Version update only*

## 0.126.0
Wed, 12 Sep 2018 19:12:10 GMT

*Version update only*

## 0.125.0
Wed, 12 Sep 2018 13:35:50 GMT

*Version update only*

## 0.124.0
Tue, 11 Sep 2018 13:52:59 GMT

### Updates

- Add initial support for the Functional domain.
- Remove PhysicalPortion and SpatialLocationPortion since those classes are deprecated in BisCore.

## 0.123.0
Wed, 05 Sep 2018 17:14:50 GMT

### Updates

- PBI#30301: Add ability to reuse briefcases when opening a new IModelConnection/IModelDb. <br/> Opening a new ReadWrite IModelConnection at the frontend would try and reuse any existing briefcase that was previously opened by the same user. Opening a new Exclusive IModelDb at the backend can be configured to reuse or create/acquire a new briefcase. <br/> PBI#30302: Add method to purge the briefcase manager cache. <br/> When backend instances are brought down it's important that any briefcases they acquired from the Hub be properly disposed of. The iModelHub imposes an artificial limit of 20 briefcases per user, and acquiring more briefcases will cause an error.Added a new BriefcaseManager.purgeCache() method to help with this - the method closes any open briefcases, deletes the registered briefcase id from the Hub, and deletes the physical cache folder containing the Dbs. Note that the accessToken passed in to the method must match the accessToken used to acquire any briefcases that are to be deleted - so this only works in the limited environment where the entire cache was hydrated for the same user.
- Product Backlog Item 30601: Fix the HTTP path (Route) for ReadWrite workflows to not include changeSetId. The Db would always be at the latest change set id for ReadWrite workflows.  So it doesn't make sense to include that in the route and keep changing it as we make PullMergeAndPush calls from the backend. 

## 0.122.0
Tue, 28 Aug 2018 12:25:19 GMT

*Version update only*

## 0.121.0
Fri, 24 Aug 2018 12:49:09 GMT

*Version update only*

## 0.120.0
Thu, 23 Aug 2018 20:51:32 GMT

*Version update only*

## 0.119.0
Thu, 23 Aug 2018 15:25:49 GMT

*Version update only*

## 0.118.0
Tue, 21 Aug 2018 17:20:41 GMT

### Updates

- TSLint New Rule Enforcements
- Updated to use TypeScript 3.0

## 0.117.0
Wed, 15 Aug 2018 17:08:53 GMT

### Updates

- Flesh out DisplayStyle API; Support iteration of ViewDefinitions

## 0.116.0
Wed, 15 Aug 2018 15:13:19 GMT

*Version update only*

## 0.115.0
Tue, 14 Aug 2018 15:21:27 GMT

*Version update only*

## 0.114.0
Tue, 14 Aug 2018 12:04:18 GMT

### Updates

- Use binary transfer for loadNativeAsset
- added IModelDb.Views.getThumbnail

## 0.113.0
Fri, 10 Aug 2018 05:06:20 GMT

*Version update only*

## 0.112.0
Tue, 07 Aug 2018 12:19:22 GMT

### Updates

- Add GeometricModel.queryExtents

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

