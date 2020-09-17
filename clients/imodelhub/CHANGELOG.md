# Change Log - @bentley/imodelhub-client

This log was last generated on Thu, 17 Sep 2020 13:16:12 GMT and should not be manually modified.

## 2.6.0
Thu, 17 Sep 2020 13:16:12 GMT

### Updates

- Moved ESLint configuration to a plugin

## 2.5.5
Wed, 02 Sep 2020 17:42:23 GMT

*Version update only*

## 2.5.4
Fri, 28 Aug 2020 15:34:15 GMT

*Version update only*

## 2.5.3
Wed, 26 Aug 2020 11:46:00 GMT

*Version update only*

## 2.5.2
Tue, 25 Aug 2020 22:09:08 GMT

*Version update only*

## 2.5.1
Mon, 24 Aug 2020 18:13:04 GMT

*Version update only*

## 2.5.0
Thu, 20 Aug 2020 20:57:09 GMT

### Updates

- Added applicationVersion parameter to iModelHubClient constructor that will be used in all requests.
- Added iModelHub ClientAPIs for BlockCacheVfs checkpoints
- Added a way to change headers for all requests
- Remove special code handling for mobile.
- Switch to ESLint

## 2.4.2
Fri, 14 Aug 2020 16:34:09 GMT

*Version update only*

## 2.4.1
Fri, 07 Aug 2020 19:57:43 GMT

*Version update only*

## 2.4.0
Tue, 28 Jul 2020 16:26:24 GMT

### Updates

- Modify BasicAccessToken with class decorator TokenPrefix
- iModelHub permissions handler
- Added support for iModel type, type filtering and template filtering
- Added url encoding for query segments that may contain special characters

## 2.3.3
Thu, 23 Jul 2020 12:57:15 GMT

*Version update only*

## 2.3.2
Tue, 14 Jul 2020 23:50:36 GMT

*Version update only*

## 2.3.1
Mon, 13 Jul 2020 18:50:13 GMT

*Version update only*

## 2.3.0
Fri, 10 Jul 2020 17:23:14 GMT

### Updates

- Deprecated `EventType` type alias in favor of new `IModelHubEventType` enum.

## 2.2.1
Tue, 07 Jul 2020 14:44:52 GMT

*Version update only*

## 2.2.0
Fri, 19 Jun 2020 14:10:03 GMT

*Version update only*

## 2.1.0
Thu, 28 May 2020 22:48:59 GMT

### Updates

- Added FailedToGetProductSettings error
- Download ChangeSets in chunks
- Simplified logging for monitoring briefcase operations. 

## 2.0.0
Wed, 06 May 2020 13:17:49 GMT

### Updates

- Fixed setup of UserInfo from browser clients, and more cleanups to AccessToken API. 
- Changed ChangeSets download API
- Added unlink for file handler
- Updated docs. 
- Changeset download get sas url just before starting download
- react to changes in imodeljs-clients
- update imodelbank auth clients to implement FrontendAuthorizationClient
- Updated docs to remove BriefcaseDb.create
- create new package from imodeljs-clients
- Upgrade to Rush 5.23.2

