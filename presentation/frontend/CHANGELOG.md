# Change Log - @bentley/presentation-frontend

This log was last generated on Wed, 12 Feb 2020 17:45:50 GMT and should not be manually modified.

## 1.12.0
Wed, 12 Feb 2020 17:45:50 GMT

*Version update only*

## 1.11.0
Wed, 22 Jan 2020 19:24:12 GMT

### Updates

- Added localization and support for LabelDefinitions
- Upgrade to TypeScript 3.7.2.

## 1.10.0
Tue, 07 Jan 2020 19:44:01 GMT

*Version update only*

## 1.9.0
Tue, 10 Dec 2019 18:08:56 GMT

### Updates

- Handle newly introduced multi-ECInstance nodes
- Ensure favoriting related property doesn't favorite primary instance property if it's the same property of different instances
- Update sinon version.

## 1.8.0
Fri, 22 Nov 2019 14:03:34 GMT

### Updates

- Fixed a bug when initializing favorite properties for an iModel.
- Change `HiliteSetProvider` from @internal to @alpha
- Removing favorite properties removes them from higher scopes as well.

## 1.7.0
Fri, 01 Nov 2019 13:28:37 GMT

### Updates

- Added API to save favorite properties in user settings

## 1.6.0
Wed, 09 Oct 2019 20:28:42 GMT

### Updates

- Do not favorite all nested properties inside nested content field. Instead, favorite it as a separate kind of field

## 1.5.0
Mon, 30 Sep 2019 22:28:48 GMT

### Updates

- Added API to store favorite properties
- Add ability to force-load all hierarchy with the given imodel and ruleset
- Add module descriptions
- Added Ruleset and Ruleset variables to request options to support stateless presentation backend
- upgrade to TypeScript 3.6.2

## 1.4.0
Tue, 10 Sep 2019 12:09:49 GMT

*Version update only*

## 1.3.0
Tue, 13 Aug 2019 20:25:53 GMT

*Version update only*

## 1.2.0
Wed, 24 Jul 2019 11:47:26 GMT

*Version update only*

## 1.1.0
Mon, 01 Jul 2019 19:04:29 GMT

### Updates

- Add missing HiliteRules.json file to published package.
- Reorganize docs script output
- Request hilite list in batches to avoid HTTP413 error
- Add API to get hilite set for current selection
- Add ability to suspend tool selection set synchronization with logical selection
- Apply selection scopes when using fence or line selection
- Update to TypeScript 3.5

## 1.0.0
Mon, 03 Jun 2019 18:09:39 GMT

### Updates

- Add transient element IDs to selection when syncing from tool selection set
- Add release tags
- Cleanup API
- Refactor RPC interface to use pure JSON objects

## 0.191.0
Mon, 13 May 2019 15:52:05 GMT

### Updates

- Adds parameter for api-extractor to validate missing release tags
- Fix broken links
- Put sourcemap in npm package.
- Fix marshaling class instances through RPC by removing use of Readonly
- Add APIs to retrieve instance labels
- Do *not* use selection scopes when fence selecting or selection scope is set to "element"
- `SelectionScopesManager` now stores the active selection scope
- `SelectionManager` now has ability to sync itself with `IModelConnection.selectionSet`
- Allow sending content descriptor overrides instead of descriptor when requesting content. This allows to competely avoid a descriptor request when content customization requirements are the same for all kinds of content.
- Do not include transient element IDs when syncing with logical selection
- Always compute selection when syncing tool selection with logical selection - that's necessary to determine concrete element class names. Without that, we're adding keys with "BisCore:Element" class to selection and then our keys compare fails (presentation components like the table always have concrete class names). This can cause rows / nodes not to be highlighted in components.
- remove IModelApp subclasses
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
- Use new buildIModelJsBuild script
- Remove unneeded typedoc plugin dependency
- Uncomment and fixed test
- Save BUILD_SEMVER to globally accessible map
- Add an API for getting selection scopes and computing selection based on a selection scope.
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

- Fix linter warnings
- Allow specifying `clientId` for PresentationManager. This allows consumers to use clientId that's shared between sessions which makes it possible for presentation framework to share caches.

## 0.178.0
Thu, 13 Dec 2018 22:06:10 GMT

*Version update only*

## 0.177.0
Wed, 12 Dec 2018 17:21:32 GMT

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

### Updates

- Changed index file name to match package name, eliminate subdirectory index files, decrease usage of default exports, change imports to use other packages' index file.

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

### Updates

- Unified Selection: Do not broadcast selection changes if there are no actual changes

## 0.164.0
Thu, 08 Nov 2018 17:59:21 GMT

### Updates

- Updated to TypeScript 3.1

## 0.163.0
Wed, 31 Oct 2018 20:55:37 GMT

*Version update only*

## 0.162.0
Wed, 24 Oct 2018 19:20:07 GMT

### Updates

- Breaking changes to optimize usage of 64-bit IDs.
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

