# Change Log - @itwin/core-transformer

This log was last generated on Fri, 26 Aug 2022 15:40:02 GMT and should not be manually modified.

## 3.3.1
Fri, 26 Aug 2022 15:40:02 GMT

_Version update only_

## 3.3.0
Thu, 18 Aug 2022 19:08:02 GMT

### Updates

- upgrade mocha to version 10.0.0
- always close transformer resumption state db even on errors
- make sure tests use a unique cacheDir
- IModelHost.startup now accepts IModelHostOptions interface rather than IModelHostConfiguration instance
- move HubMock to core-backend
- deprecate danglingPredecessorsBehavior in favor of danglingReferencesBehavior
- fix IModelExporter not exporting brep data when exporting geometry
- Fix assertion on valid case in mapId64.

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

- always close transformer resumption state db even on errors
- Add an option to IModelImporter to optimize geometry by identifying geometry parts with only one reference and embedding the part's geometry directly into the referencing element's geometry stream.
- add transformer resumption API
- use refactored internal extractChangedIdsFromChangesets

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
Tue, 29 Mar 2022 20:53:47 GMT

### Updates

- mitigate memory leak in large model processing

## 3.0.3
Fri, 25 Mar 2022 15:10:02 GMT

_Version update only_

## 3.0.2
Thu, 10 Mar 2022 21:18:13 GMT

_Version update only_

## 3.0.1
Thu, 24 Feb 2022 15:26:55 GMT

### Updates

- add ignoreDeadPredecessors option to transformer, deprecate direct importer options access
- Upgrade target to ES2019
- rename contextId -> iTwinId
- rename to @itwin/core-transformer
- remove ClientRequestContext and its subclasses
- removed deprecated API surface
- remove ClientRequestContext.current
- Renamed all occurrences of the term revision0 to version0.
- remove requestContext argument from importSchemas
- create new imodel-transformer package separate from backend package
- fix bug where element aspect export could be mishandled when the element was deferred
- add preserveElementIdsForFiltering option for transformations

## 3.0.0
Fri, 20 Aug 2021 20:34:29 GMT

### Updates

- Initial release

