# Change Log - @itwin/core-transformer

This log was last generated on Tue, 25 Apr 2023 17:50:35 GMT and should not be manually modified.

## 3.7.4
Tue, 25 Apr 2023 17:50:35 GMT

_Version update only_

## 3.7.3
Thu, 20 Apr 2023 13:19:29 GMT

_Version update only_

## 3.7.2
Wed, 12 Apr 2023 13:12:42 GMT

_Version update only_

## 3.7.1
Mon, 03 Apr 2023 15:15:37 GMT

_Version update only_

## 3.7.0
Wed, 29 Mar 2023 15:02:27 GMT

_Version update only_

## 3.6.3
Mon, 27 Mar 2023 16:26:47 GMT

_Version update only_

## 3.6.2
Fri, 17 Mar 2023 17:52:32 GMT

_Version update only_

## 3.6.1
Fri, 24 Feb 2023 22:00:48 GMT

_Version update only_

## 3.6.0
Wed, 08 Feb 2023 14:58:40 GMT

### Updates

- handle long named schemas on linux
- do not download unnecessary changesets past the source changeset when processing changesets

## 3.5.6
Fri, 24 Feb 2023 16:02:47 GMT

_Version update only_

## 3.5.5
Thu, 26 Jan 2023 22:53:27 GMT

_Version update only_

## 3.5.4
Wed, 18 Jan 2023 15:27:15 GMT

_Version update only_

## 3.5.3
Fri, 13 Jan 2023 17:23:07 GMT

_Version update only_

## 3.5.2
Wed, 11 Jan 2023 16:46:30 GMT

_Version update only_

## 3.5.1
Thu, 15 Dec 2022 16:38:29 GMT

_Version update only_

## 3.5.0
Wed, 07 Dec 2022 19:12:37 GMT

### Updates

- use EntityReferences to support deferring non-element entities

## 3.4.7
Wed, 30 Nov 2022 14:28:19 GMT

_Version update only_

## 3.4.6
Tue, 22 Nov 2022 14:24:19 GMT

_Version update only_

## 3.4.5
Thu, 17 Nov 2022 21:32:50 GMT

_Version update only_

## 3.4.4
Thu, 10 Nov 2022 19:32:17 GMT

### Updates

- handle null ExternalSourceAspect.scope, process system schemas by default

## 3.4.3
Fri, 28 Oct 2022 13:34:58 GMT

_Version update only_

## 3.4.2
Mon, 24 Oct 2022 13:23:45 GMT

_Version update only_

## 3.4.1
Mon, 17 Oct 2022 20:06:51 GMT

### Updates

- use EntityReferences to support deferring non-element entities

## 3.4.0
Thu, 13 Oct 2022 20:24:47 GMT

### Updates

- Switch from the IModelSchemaLoader to the SchemaLoader
- select * on link tables now also includes SourceECClassId and TargetECClassId
- lock down @types/semver to 7.3.10
- Updated Node types declaration to support latest v16
- handle cascading deletes in IModelTransformer.processChanges
- fix element deletions in reverse synchronization

## 3.3.5
Tue, 27 Sep 2022 11:50:59 GMT

_Version update only_

## 3.3.4
Thu, 08 Sep 2022 19:00:05 GMT

_Version update only_

## 3.3.3
Tue, 06 Sep 2022 20:54:19 GMT

_Version update only_

## 3.3.2
Thu, 01 Sep 2022 14:37:22 GMT

_Version update only_

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

