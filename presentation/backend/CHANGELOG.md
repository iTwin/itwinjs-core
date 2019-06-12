# Change Log - @bentley/presentation-backend

This log was last generated on Mon, 03 Jun 2019 18:09:39 GMT and should not be manually modified.

## 1.0.0
Mon, 03 Jun 2019 18:09:39 GMT

### Updates

- Increased default backend timeout up to 90 seconds.
- Removed backend timeout when it is set to 0.
- Added backend timeout closure when request is completed.
- Timeout clearing moved to 'finally' block
- Added presentation request timing out if it takes longer that predefined periond of time.
- Add release tags
- Cleanup API
- Refactor RPC interface to use pure JSON objects

## 0.191.0
Mon, 13 May 2019 15:52:05 GMT

### Updates

- Adds parameter for api-extractor to validate missing release tags
- remove requirement that JavaScript classnames match BIS classnames
- Fix broken links
- Fix marshaling class instances through RPC by removing use of Readonly
- Fix content requests for BisCore.Element instances when only the base class name is specified (usual case when selecting elements from the viewport)
- Disable "category" and "model" selection scopes
- Dispose PresentationManager in the same client request context as it was created in.
- Fix `computeSelection` and content requests failing when given a key with invalid BisCore:Element id
- Add APIs to retrieve instance labels
- Fixed `PresentationRpcImpl.computeSelection` for "model", "category" and "element" scope to return specific class names instead of "BisCore:Model", "BisCore:Category" or "BisCore:Element"
- Allow requesting content with descriptor overrides instead of descriptor. This allows to competely avoid a descriptor request when content customization requirements are the same for all kinds of content
- Do not attempt to handle transient element ids when computing selection based on scope
- Setup a generic context for tracking client requests, and made various related enhancements to logging, usage tracking and authorization. 
- Upgrade TypeDoc dependency to 0.14.2

## 0.190.0
Thu, 14 Mar 2019 14:26:49 GMT

### Updates

- Fix test scripts for unix systems

## 0.189.0
Wed, 06 Mar 2019 15:41:22 GMT

### Updates

- Changes package.json to include api-extractor and adds api-extractor.json
- Wrapped PresentationRpcImpl method response values in PresentationRpcInterface object.
- Use new buildIModelJsBuild script
- PresentationManager now converts locale string to lower case when creating request parameters.
- Remove unneeded typedoc plugin dependency
- Add hardcoded implementations for 'element', 'assembly', 'top-assembly', 'category', 'model' selection scopes
- RPC Interface changes to optimize getting first page of nodes/content
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

*Version update only*

## 0.183.0
Mon, 07 Jan 2019 21:49:21 GMT

*Version update only*

## 0.182.0
Mon, 07 Jan 2019 13:31:34 GMT

### Updates

- move to Node 10

## 0.181.0
Fri, 04 Jan 2019 13:02:40 GMT

### Updates

- move to Node 10

## 0.180.0
Wed, 02 Jan 2019 15:18:23 GMT

*Version update only*

## 0.179.0
Wed, 19 Dec 2018 18:26:14 GMT

### Updates

- Added RulesetEmbedder to embed and get rules to/from iModelDb

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

### Updates

- Remove unused dependencies, add `build:watch` script

## 0.173.0
Thu, 06 Dec 2018 22:03:29 GMT

*Version update only*

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

- Updated to TypeScript 3.1

## 0.163.0
Wed, 31 Oct 2018 20:55:37 GMT

*Version update only*

## 0.162.0
Wed, 24 Oct 2018 19:20:06 GMT

### Updates

- Fixed reduced test coverage

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

