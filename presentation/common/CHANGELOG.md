# Change Log - @bentley/presentation-common

This log was last generated on Fri, 28 Sep 2018 00:57:48 GMT and should not be manually modified.

## 0.137.0
Fri, 28 Sep 2018 00:57:48 GMT

*Version update only*

## 0.136.0
Thu, 27 Sep 2018 15:02:45 GMT

*Version update only*

## 0.135.0
Wed, 26 Sep 2018 19:16:30 GMT

*Version update only*

## 0.134.0
Wed, 26 Sep 2018 00:50:11 GMT

*Version update only*

## 0.133.0
Tue, 25 Sep 2018 16:41:02 GMT

### Updates

- NodePathElement got additional field - FilteringData

## 0.132.0
Mon, 24 Sep 2018 18:55:46 GMT

*Version update only*

## 0.131.0
Sun, 23 Sep 2018 17:07:30 GMT

*Version update only*

## 0.130.0
Sun, 23 Sep 2018 01:19:16 GMT

*Version update only*

## 0.129.0
Fri, 21 Sep 2018 23:16:13 GMT

### Updates

- Add missing documentation for rules' `condition` parameter

## 0.128.0
Fri, 14 Sep 2018 17:08:05 GMT

### Updates

- Fixed invalid documentation reference
- Fix module names and visibility

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

- RPC API fixes for web use cases

## 0.123.0
Wed, 05 Sep 2018 17:14:50 GMT

### Updates

- Fix IModelToken not being found in RPC requests

## 0.122.0
Tue, 28 Aug 2018 12:25:19 GMT

### Updates

- Handle cases when frontend is connected to unknown backend by syncing client state with the new backend

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
Wed, 15 Aug 2018 17:08:54 GMT

*Version update only*

## 0.116.0
Wed, 15 Aug 2018 15:13:19 GMT

*Version update only*

## 0.115.0
Tue, 14 Aug 2018 15:21:27 GMT

*Version update only*

## 0.114.0
Tue, 14 Aug 2018 12:04:18 GMT

*Version update only*

## 0.113.0
Fri, 10 Aug 2018 05:06:20 GMT

### Minor changes

- Rename `ECPresentation` to `Presentation`
- Refactor PresentationRuleSet JSON schema to make it clearer and less ambiguous
- IRulesetManager API changes
- User Settings rename to Ruleset Variables and related API changes

### Patches

- Generate JSON schema for Ruleset data structure
- RegisteredRuleset now contains ruleset's hash which helps us verify ruleset integrity

## 0.5.1
Thu, 02 Aug 2018 17:56:36 GMT

### Patches

- Update imodeljs-core dependency versions to 0.109.0

## 0.5.0
Tue, 24 Jul 2018 13:20:35 GMT

### Minor changes

- Added api for getting distinct values.
- Added api for getting node paths and filtered node paths.
- Remove ruleset management functions from ECPresentationManager
- Change the format of request options.
- Active locale is now a property of request options rather than presentation manager / RPC interface.
- Rename UserSettingsManager interface to IUserSettingsManager

### Patches

- Move Omit & Subtract definitions from `controls` to `common`
- Create an interface for IRulesetManager and a concept of RegisteredRuleSet
- Fixed KeySet serialization.

## 0.4.1
Fri, 22 Jun 2018 10:25:30 GMT

### Patches

- Update package dependencies

## 0.4.0
Thu, 14 Jun 2018 12:12:59 GMT

### Minor changes

- Change ECPresentation manager to work with IModel instead of IModelToken
- Added interfaces for UserSettingsManager.

### Patches

- Deserialization fixes
- Add LoggingNamespaces enum that lists all logger namespaces used by ECPresentation library
- Type safe ValuesDictionary

## 0.3.1
Wed, 23 May 2018 10:15:48 GMT

### Patches

- Update imodeljs-core dependencies to 0.88

## 0.3.0
Fri, 18 May 2018 14:15:29 GMT

### Minor changes

- Added interfaces for presentation rules.
- ECPresentationManager.getContentDescriptor may return no descriptor if there is none with the specified parameters.

### Patches

- Add missing documentation
- Use ECPresentationError instead of generic Error.

## 0.2.0
Fri, 11 May 2018 06:57:38 GMT

### Minor changes

- React to Gateway's API changes: renamed ECPresentationGateway to ECPresentationRpcInterface.

## 0.1.2
Tue, 08 May 2018 07:05:52 GMT

### Patches

- 100% unit test coverage
- Fix Changes.js.map being included into the package.
- Update imodeljs-core dependencies to 0.80
- Update bentleyjs-core dependency to 8

## 0.1.1
Sun, 29 Apr 2018 08:07:40 GMT

### Patches

- Fixed packaging.

## 0.1.0
Thu, 26 Apr 2018 09:27:06 GMT

### Patches

- Added a KeySet and PersistentKeysContainer definition. Changed InstanceKey definition to store class name instead of id.
- KeySet (de)serialization for passing over gateway / addon boundary
- PresentationManager now accepts keys as KeySets
- Fixed node keys deserialization.
- Readonly-ness fixes
- KeySet can now work with other KeySets or SerializedKeySets
- API cleanup
- Stop using intermediate JSON format for data objects

## 0.0.5
Fri, 20 Apr 2018 13:57:47 GMT

### Patches

- Created compound index.ts file that exports package contents so consumers don't have to import each package piece individually through "lib" directory.
- Updated package dependencies

## 0.0.1
Wed, 28 Feb 2018 13:44:55 GMT

### Patches

- Created a new package for common ecpresentation classes / utils.

