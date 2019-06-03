# Change Log - @bentley/imodeljs-clients-backend

This log was last generated on Mon, 03 Jun 2019 18:09:39 GMT and should not be manually modified.

## 1.0.0
Mon, 03 Jun 2019 18:09:39 GMT

### Updates

- Migrated agent applications to the newer client 
- Updated release tags. 
- Added an error for seed file initialization timeout
- Switched from iModelHub Project API to Context API
- Updated tests to use new ownedByMe option when quering briefcases
- Fixed Date fields in OIDC AccessTokens.
- Refactored and simplified implementation of IModelDb.open
- Use paging for Locks, Codes and ChangeSets

## 0.191.0
Mon, 13 May 2019 15:52:05 GMT

### Updates

- Adds parameter for api-extractor to validate missing release tags
- added azcopy support
- Changed download buffering code to do less memory allocations, changed default download buffer size from 1MB to 20MB to improve download performance to File Shares, added automatic enabling of the 20MB buffer when downloading to File Shares using UNC path, otherwise using no buffer for better SSD download performance.
- Allowed setup of global Request timeouts. 
- Added initial iModelHub Checkpoint API.
- Introduce LoggerCategory enum to advertise logger categories used by this package.
- Fix broken links
- LoggerCategory -> ClientsLoggerCategory
- add support for imodelbank in imodelhub integration tests
- Increased timeout in tests when iModel is created from seed file.
- Reinstated old version of OidcAgentClient
- Fixes to OidcBrowserClient. 
- Reallocate azcopy log to temp
- Setup a generic context for tracking client requests, and made various related enhancements to logging, usage tracking and authorization. 
- Upgrade TypeDoc dependency to 0.14.2

## 0.190.0
Thu, 14 Mar 2019 14:26:49 GMT

### Updates

- Add missing peerDependencies on @bentley/geometry-core and @bentley/imodeljs-clients
- Allow mobile webpack to skip node dependent module
- Replaced OidcAgentClient with OidcAgentClientV2.
- Reverted changes to OidcAgentClient. 

## 0.189.0
Wed, 06 Mar 2019 15:41:22 GMT

### Updates

- Added OidcAgentClientV2. This will replace OidcAgentClient after some fixes from IMS+Connect. 
- ChangeSet and Briefcase downloads are atomic (i.e., will not be partially downloaded) and can simultaneously happen in multiple machines. 
- Changes package.json to include api-extractor and adds api-extractor.json
- Use new buildIModelJsBuild script
- Moved AzureFileHandler, IOSAzureFileHandler, UrlFileHandler and the iModelHub tests to the imodeljs-clients-backend package. This removes the dependency of imodeljs-clients on the "fs" module, and turns it into a browser only package. 
- Fixes to OidcDelegationClient-s. 
- Remove unneeded typedoc plugin dependency
- Create iModel from empty template if seed file path not defined.
- Removed RBAC client - the RBAC service is considered internal. 
- upgrade to TypeScript 3.2.2

## 0.188.0
Wed, 16 Jan 2019 16:36:09 GMT

*Version update only*

## 0.187.0
Tue, 15 Jan 2019 15:18:59 GMT

### Updates

- Fixed https-proxy-agent dependency. 

## 0.186.0
Mon, 14 Jan 2019 23:09:10 GMT

### Updates

- More logging of HTTP requests, and enabled use of fiddler for backend diagnostics. 
- Renamed RequestProxy->RequestHost. Allowed applications to configure proxy server with HTTPS_PROXY env. 

## 0.185.0
Fri, 11 Jan 2019 18:29:00 GMT

*Version update only*

## 0.184.0
Thu, 10 Jan 2019 22:46:17 GMT

### Updates

- Removed default OIDC scopes. All applications must now explicitly pass the required scopes.

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

*Version update only*

## 0.178.0
Thu, 13 Dec 2018 22:06:10 GMT

*Version update only*

## 0.177.0
Wed, 12 Dec 2018 17:21:31 GMT

*Version update only*

## 0.176.0
Mon, 10 Dec 2018 21:19:45 GMT

*Version update only*

## 0.175.0
Mon, 10 Dec 2018 17:08:55 GMT

*Version update only*

## 0.174.0
Mon, 10 Dec 2018 13:24:09 GMT

*Version update only*

## 0.173.0
Thu, 06 Dec 2018 22:03:29 GMT

### Updates

- Custom imodelJs noDirectImport lint rule implemented, noDuplicateImport lint rule turned on.

## 0.172.0
Tue, 04 Dec 2018 17:24:39 GMT

*Version update only*

## 0.171.0
Mon, 03 Dec 2018 18:52:58 GMT

*Version update only*

## 0.170.0
Mon, 26 Nov 2018 19:38:42 GMT

*Version update only*

## 0.169.0
Tue, 20 Nov 2018 16:17:15 GMT

*Version update only*

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

*Version update only*

## 0.164.0
Thu, 08 Nov 2018 17:59:20 GMT

### Updates

- OIDC related enhancments (WIP).
- Updated to TypeScript 3.1

## 0.163.0
Wed, 31 Oct 2018 20:55:37 GMT

*Version update only*

## 0.162.0
Wed, 24 Oct 2018 19:20:06 GMT

*Version update only*

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
- Added a README with link to iModel.js documentation.

## 0.156.0
Fri, 12 Oct 2018 23:00:10 GMT

### Updates

- Initial release

