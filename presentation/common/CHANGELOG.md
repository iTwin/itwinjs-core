# Change Log - @bentley/presentation-common

This log was last generated on Wed, 04 Mar 2020 16:16:31 GMT and should not be manually modified.

## 1.13.0
Wed, 04 Mar 2020 16:16:31 GMT

*Version update only*

## 1.12.0
Wed, 12 Feb 2020 17:45:50 GMT

### Updates

- Fix broken links
- Make `KeySetJSON` and related types public
- Add multi-step relationship path's support in presentation rules.
- Implement multi-step relationship paths support for find similar ruleset

## 1.11.0
Wed, 22 Jan 2020 19:24:12 GMT

### Updates

- Added LabelDefinition and changed Node label property type to LabelDefinition
- Include missing assets directory into package
- Rename `ContentInstancesOfSpecificClassesSpecification.arePolymorphic` to `handleInstancesPolymorphically` to remove ambiguity
- Upgrade to TypeScript 3.7.2.

## 1.10.0
Tue, 07 Jan 2020 19:44:01 GMT

*Version update only*

## 1.9.0
Tue, 10 Dec 2019 18:08:56 GMT

### Updates

- Fix double quotes not being properly escaped when creating 'find similar' ruleset.
- Add support for multi-ECInstance nodes
- Add a way to group same-label ECInstance nodes at post-processing stage
- Add `NestedContentField.getFieldByName`
- Update sinon version.

## 1.8.0
Fri, 22 Nov 2019 14:03:34 GMT

### Updates

- Add property overrides' rule
- Deprecate `PropertiesDisplaySpecification` in favor of `PropertyOverrides`
- Deprecate `PropertyEditorsSpecification` in favor of `PropertyOverrides`

## 1.7.0
Fri, 01 Nov 2019 13:28:37 GMT

*Version update only*

## 1.6.0
Wed, 09 Oct 2019 20:28:42 GMT

*Version update only*

## 1.5.0
Mon, 30 Sep 2019 22:28:48 GMT

### Updates

- Add `PresentationStatus.Canceled` member
- Add ability to force-load all hierarchy with the given imodel and ruleset
- Added autoExpand property to RelatedPropertiesSpecification and NestedContentField
- Add module descriptions
- Added Ruleset and Ruleset variables to request options to support stateless presentation backend
- Store navigation property classes separate from related property paths
- upgrade to TypeScript 3.6.2

## 1.4.0
Tue, 10 Sep 2019 12:09:49 GMT

### Updates

- Escape double quotes when creating intance filter for 'find similar' ruleset
- Add NodeArtifacts presentation rule
- Add `hideExpression` attribute to node specifications

## 1.3.0
Tue, 13 Aug 2019 20:25:53 GMT

### Updates

- Add special handling for double values when creating 'similar instances' presentantation ruleset
- Add special handling for point values when creating 'similar instances' presentation ruleset
- Add special handling for DateTime values when creating 'similar instances' presentation ruleset

## 1.2.0
Wed, 24 Jul 2019 11:47:26 GMT

*Version update only*

## 1.1.0
Mon, 01 Jul 2019 19:04:29 GMT

### Updates

- Reorganize docs script output
- Add functions `KeySet.forEach` and `KeySet.forEachBatch`
- Downgrade json-schema-faker dependency to version `0.5.0-rc16` as `rc17` causes some tests to crash
- Add "String" value specification for `InstanceLabelOverride` rule
- Update to TypeScript 3.5

## 1.0.0
Mon, 03 Jun 2019 18:09:39 GMT

### Updates

- RPC system now accepts only basic values (primitives, "interface" objects, and binary).
- Add optional predicate parameter to `KeySet.add` to filter added keys
- Add a new presentation rule `ExtendedDataRule` for injecting custom data into presentation objects.
- Refactor InstanceLabelOverride rule for more flexibility
- Added handling for timeouted backend responses with request repeating
- Add release tags
- Cleanup API
- Refactor RPC interface to use pure JSON objects
- Fix content descriptor deserialization

## 0.191.0
Mon, 13 May 2019 15:52:05 GMT

### Updates

- Adds parameter for api-extractor to validate missing release tags
- Fix broken links
- Put sourcemap in npm package.
- Fix creating a KeySet from EntityProps which have a `type` property
- Fix marshaling class instances through RPC by removing use of Readonly
- Add APIs to retrieve instance labels
- Changed `PresentationRpcInterface.computeSelection` to take `Id64String[]` instead of `EntityProps[]`
- Allow sending content descriptor overrides instead of descriptor when requesting content. This allows to competely avoid a descriptor request when content customization requirements are the same for all kinds of content
- Upgrade TypeDoc dependency to 0.14.2

## 0.190.0
Thu, 14 Mar 2019 14:26:49 GMT

### Updates

- Documentation fixes
- Fix test scripts for unix systems

## 0.189.0
Wed, 06 Mar 2019 15:41:22 GMT

### Updates

- Changes package.json to include api-extractor and adds api-extractor.json
- Added RpcResponse and PresentationRpcResponse interfaces and changed PresentationRpcInterface to return PresentationRpcResponses instead of raw values.
- Use new buildIModelJsBuild script
- Remove unneeded typedoc plugin dependency
- Create RulesetFactory API for creating presentation rulesets targeted towards specific cases, like 'find similar', etc.
- Save BUILD_SEMVER to globally accessible map
- Change `RulesetsFactory.createSimilarInstancesRuleset` return type from a `Ruleset` to `{ ruleset: Ruleset, description: string }`
- Fix RPC requests handler to re-request data if frontend got out-of-sync while syncing with the backed.
- Add selection scopes -related RPC handlers
- RPC Interface changes to optimize getting first page of nodes/content
- Expose node key type guards through index
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

### Updates

- Introduce `groupedInstancesCount` property for grouping node keys
- Add `KeySet.instanceKeysCount` and `KeySet.nodeKeysCount` which are faster versions of `KeySet.instanceKeys.size` and `KeySet.nodeKeys.size`
- Add helper functions to identify type of node key
- Add `getInstancesCount` function to calculate total number of instances included in a `KeySet`

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

- Invert `isSelectable` property to `isSelectionDisabled` so in the most common case (selectable = true) we don't have to send the value

## 0.178.0
Thu, 13 Dec 2018 22:06:10 GMT

*Version update only*

## 0.177.0
Wed, 12 Dec 2018 17:21:31 GMT

*Version update only*

## 0.176.0
Mon, 10 Dec 2018 21:19:45 GMT

### Updates

- React to signature change for RpcInterface.forward

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

- Add KeySet.hasAll and KeySet.hasAny to check set contents
- Add KeySet.guid to check if keys have changed

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

- Fix value deserialization when values were not set (null vs undefined)
- Hide internal types from declarations and docs

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

