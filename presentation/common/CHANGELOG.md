# Change Log - @itwin/presentation-common

This log was last generated on Wed, 16 Jul 2025 15:01:35 GMT and should not be manually modified.

## 5.0.4
Wed, 16 Jul 2025 14:59:59 GMT

_Version update only_

## 5.0.3
Fri, 11 Jul 2025 00:56:56 GMT

_Version update only_

## 5.0.2
Thu, 26 Jun 2025 22:16:01 GMT

_Version update only_

## 5.0.1
Tue, 17 Jun 2025 18:33:52 GMT

_Version update only_

## 5.0.0
Fri, 13 Jun 2025 20:25:38 GMT

### Minor changes

- All public methods of `PresentationRpcInterface` have been deprecated. Going forward, RPC interfaces should not be called directly. Public wrappers such as `PresentationManager` should be used instead.

### Updates

- Export `Ruleset.schema.json` through exports field
- Add value constraints to `PropertyInfo`
- KeySet: Always store instance key class name in `Schema:Class` format.
- Upgrade compile target to ES2023 and module to ES2022
- Fixed enum property values formatting issue, where raw value was used instead of enum's display value.
- Fix `InstanceKey.compare` implementation not taking into account different formats and casings of full class name.
- Deprecate `imageId` property of `CustomNodeSpecification` and `PropertyRangeGroupSpecification`.
- Deprecate `labelDefinition` property of `ItemJSON` and `NestedContentValue` in favor of newly added `label`.
- Deprecate `fromJSON` and `toJSON` methods of `Field` and its subclasses.
- Add `type: "module"` to `package.json` to tell Node.js to load this package as ESM by default.
- Deprecate unified selection related APIs.
- When serializing content, don't put `undefined` values to JSON.
- Extend `MultiElementPropertiesRequestOptions` to support specifying input element either through `elementClasses` or `elementIds` arrays.
- Remove `@internal` APIs from public barrel exports file.
- Stop using `Object.create` and `Object.assign` and use proper constructors and operators instead.
- Clean up APIs deprecated in 3.x
- Refactor RPC "pending" response handling to rely on our RPC system rather than custom implementation
- Change core peer dependencies to strict version.

## 4.11.6
Mon, 16 Jun 2025 15:00:15 GMT

_Version update only_

## 4.11.5
Fri, 06 Jun 2025 13:41:18 GMT

### Updates

- Fix `InstanceKey.compare` implementation not taking into account different formats and casings of full class name.

## 4.11.4
Tue, 03 Jun 2025 16:15:19 GMT

_Version update only_

## 4.11.3
Wed, 28 May 2025 13:56:23 GMT

_Version update only_

## 4.11.2
Tue, 20 May 2025 20:14:46 GMT

_Version update only_

## 4.11.1
Wed, 30 Apr 2025 13:13:21 GMT

_Version update only_

## 4.11.0
Wed, 16 Apr 2025 15:50:28 GMT

### Minor changes

- All public methods of `PresentationRpcInterface` have been deprecated. Going forward, RPC interfaces should not be called directly. Public wrappers such as `PresentationManager` should be used instead.

### Updates

- KeySet: Always store instance key class name in `Schema:Class` format.
- Fixed enum property values formatting issue, where raw value was used instead of enum's display value.
- Extend `MultiElementPropertiesRequestOptions` to support specifying input element either through `elementClasses` or `elementIds` arrays.

## 4.10.13
Thu, 10 Apr 2025 17:47:21 GMT

_Version update only_

## 4.10.12
Wed, 02 Apr 2025 19:35:47 GMT

_Version update only_

## 4.10.11
Wed, 19 Mar 2025 15:30:39 GMT

_Version update only_

## 4.10.10
Tue, 11 Mar 2025 15:25:11 GMT

_Version update only_

## 4.10.9
Tue, 11 Mar 2025 05:17:33 GMT

_Version update only_

## 4.10.8
Thu, 06 Mar 2025 14:13:37 GMT

_Version update only_

## 4.10.7
Tue, 18 Feb 2025 17:27:03 GMT

_Version update only_

## 4.10.6
Fri, 24 Jan 2025 08:02:40 GMT

_Version update only_

## 4.10.5
Tue, 21 Jan 2025 21:56:45 GMT

_Version update only_

## 4.10.4
Mon, 13 Jan 2025 14:06:43 GMT

_Version update only_

## 4.10.3
Mon, 06 Jan 2025 14:00:13 GMT

_Version update only_

## 4.10.2
Thu, 21 Nov 2024 15:22:20 GMT

_Version update only_

## 4.10.1
Thu, 14 Nov 2024 18:11:00 GMT

### Updates

- Fixed enum property values formatting issue, where raw value was used instead of enum's display value.

## 4.10.0
Wed, 13 Nov 2024 15:23:39 GMT

### Minor changes

- All public methods of `PresentationRpcInterface` have been deprecated. Going forward, RPC interfaces should not be called directly. Public wrappers such as `PresentationManager` should be used instead.

### Updates

- Add extended data for calculated properties
- ContentFormatter does not throw when formatting properties with 'undefined' value
- KeySet: Always store instance key class name in `Schema:Class` format.
- Fix failure to deserialize content from JSON for instances with nulls in array property values

## 4.9.7
Wed, 06 Nov 2024 19:23:04 GMT

### Updates

- ContentFormatter does not throw when formatting properties with 'undefined' value

## 4.9.6
Tue, 05 Nov 2024 15:22:46 GMT

_Version update only_

## 4.9.5
Tue, 22 Oct 2024 20:01:40 GMT

_Version update only_

## 4.9.4
Wed, 09 Oct 2024 20:22:04 GMT

_Version update only_

## 4.9.3
Thu, 03 Oct 2024 19:15:45 GMT

_Version update only_

## 4.9.2
Wed, 02 Oct 2024 15:14:43 GMT

_Version update only_

## 4.9.1
Wed, 25 Sep 2024 20:10:58 GMT

### Updates

- Fix failure to deserialize content from JSON for instances with nulls in array property values

## 4.9.0
Mon, 23 Sep 2024 13:44:01 GMT

### Updates

- Different value type support for calculated properties
- Add extended data for calculated properties
- Make calculated property value optional
- Support schema-based property category overrides

## 4.8.7
Fri, 13 Sep 2024 15:11:17 GMT

_Version update only_

## 4.8.6
Fri, 06 Sep 2024 05:06:49 GMT

_Version update only_

## 4.8.5
Wed, 28 Aug 2024 17:27:23 GMT

_Version update only_

## 4.8.4
Thu, 22 Aug 2024 17:37:07 GMT

_Version update only_

## 4.8.3
Fri, 16 Aug 2024 18:18:14 GMT

_Version update only_

## 4.8.2
Thu, 15 Aug 2024 15:33:49 GMT

_Version update only_

## 4.8.1
Mon, 12 Aug 2024 14:05:54 GMT

_Version update only_

## 4.8.0
Thu, 08 Aug 2024 16:15:38 GMT

### Updates

- Add `NestedContentValue.labelDefinition` property which is passed to `IContentVisitor.startStruct`.
- API promotions

## 4.7.8
Wed, 31 Jul 2024 13:38:04 GMT

_Version update only_

## 4.7.7
Fri, 19 Jul 2024 14:52:42 GMT

_Version update only_

## 4.7.6
Fri, 12 Jul 2024 14:42:56 GMT

_Version update only_

## 4.7.5
Thu, 11 Jul 2024 15:24:55 GMT

_Version update only_

## 4.7.4
Mon, 01 Jul 2024 14:06:24 GMT

_Version update only_

## 4.7.3
Thu, 27 Jun 2024 21:09:02 GMT

_Version update only_

## 4.7.2
Sat, 22 Jun 2024 01:09:54 GMT

_Version update only_

## 4.7.1
Thu, 13 Jun 2024 22:47:32 GMT

_Version update only_

## 4.7.0
Wed, 12 Jun 2024 18:02:16 GMT

_Version update only_

## 4.6.2
Sat, 08 Jun 2024 00:50:25 GMT

_Version update only_

## 4.6.1
Wed, 29 May 2024 14:35:17 GMT

_Version update only_

## 4.6.0
Mon, 13 May 2024 20:32:51 GMT

_Version update only_

## 4.5.2
Tue, 16 Apr 2024 14:46:22 GMT

_Version update only_

## 4.5.1
Wed, 03 Apr 2024 18:26:59 GMT

_Version update only_

## 4.5.0
Tue, 02 Apr 2024 19:06:00 GMT

### Updates

- Updated `KeySet` to work correctly when class names uses both separators: `.` and `:`.
- Support creating hierarchy level descriptor for hierarchies that use `parent` symbol in their instance filters.
- Provide an option to control batch size for `PresentationManager.getElementProperties` multi-elements case.
- Introduce 2 new types of `PropertiesField`: `ArrayPropertiesField` and `StructPropertiesField`. Ensure values of these values can be customized, formatted, localized.

## 4.4.9
Mon, 15 Apr 2024 20:29:22 GMT

_Version update only_

## 4.4.8
Mon, 25 Mar 2024 22:22:26 GMT

_Version update only_

## 4.4.7
Fri, 15 Mar 2024 19:15:14 GMT

_Version update only_

## 4.4.6
Fri, 08 Mar 2024 15:57:12 GMT

_Version update only_

## 4.4.5
Tue, 05 Mar 2024 20:37:18 GMT

_Version update only_

## 4.4.4
Fri, 01 Mar 2024 18:21:01 GMT

_Version update only_

## 4.4.3
Fri, 23 Feb 2024 21:26:07 GMT

_Version update only_

## 4.4.2
Fri, 16 Feb 2024 14:22:01 GMT

_Version update only_

## 4.4.1
Fri, 16 Feb 2024 14:17:48 GMT

### Updates

- Support creating hierarchy level descriptor for hierarchies that use `parent` symbol in their instance filters.

## 4.4.0
Mon, 12 Feb 2024 18:15:58 GMT

### Updates

- Handle SI and METRIC unit systems as a single unit system. This fixes a problem where temperatures are formatted in Kelvin even though metric was requested.
- Provide an option to control batch size for `PresentationManager.getElementProperties` multi-elements case.
- Add formatting for kind of quantity point properties.
- Add support for default formats in `KoqPropertyValueFormatter`.

## 4.3.5
Mon, 25 Mar 2024 16:54:37 GMT

_Version update only_

## 4.3.4
Fri, 22 Mar 2024 13:30:31 GMT

_Version update only_

## 4.3.3
Wed, 03 Jan 2024 19:28:38 GMT

_Version update only_

## 4.3.2
Thu, 14 Dec 2023 20:23:02 GMT

_Version update only_

## 4.3.1
Wed, 13 Dec 2023 17:25:55 GMT

_Version update only_

## 4.3.0
Thu, 07 Dec 2023 17:43:09 GMT

### Updates

- Handle SI and METRIC unit systems as a single unit system. This fixes a problem where temperatures are formatted in Kelvin even though metric was requested.
- Add formatting for kind of quantity point properties.
- Add support for default formats in `KoqPropertyValueFormatter`.

## 4.2.4
Mon, 20 Nov 2023 16:14:45 GMT

_Version update only_

## 4.2.3
Mon, 06 Nov 2023 14:01:52 GMT

_Version update only_

## 4.2.2
Thu, 02 Nov 2023 15:36:21 GMT

_Version update only_

## 4.2.1
Tue, 24 Oct 2023 15:09:13 GMT

_Version update only_

## 4.2.0
Tue, 17 Oct 2023 15:14:32 GMT

### Updates

- Add `Field.matchesDescriptor` and `Descriptor.getFieldByDescriptor` to lookup fields by their field descriptor.

## 4.1.9
Tue, 10 Oct 2023 18:48:12 GMT

_Version update only_

## 4.1.8
Fri, 06 Oct 2023 04:00:18 GMT

_Version update only_

## 4.1.7
Thu, 28 Sep 2023 21:41:33 GMT

_Version update only_

## 4.1.6
Tue, 12 Sep 2023 15:38:52 GMT

_Version update only_

## 4.1.5
Fri, 08 Sep 2023 13:37:23 GMT

_Version update only_

## 4.1.4
Thu, 07 Sep 2023 18:26:02 GMT

_Version update only_

## 4.1.3
Wed, 30 Aug 2023 15:35:27 GMT

_Version update only_

## 4.1.2
Wed, 23 Aug 2023 15:25:30 GMT

_Version update only_

## 4.1.1
Fri, 18 Aug 2023 13:02:53 GMT

_Version update only_

## 4.1.0
Mon, 14 Aug 2023 14:36:34 GMT

### Updates

- Upgrade sinon to 15.0.4
- New attributes on calculated properties: `renderer`, `editor`, `categoryId`
- New `createClassCategory` attribute on Id category identifier
- With hierarchy level descriptor return the ruleset that was used to create that descriptor.
- Switch to ESLint new flat config system

## 4.0.7
Thu, 10 Aug 2023 13:19:24 GMT

_Version update only_

## 4.0.6
Mon, 24 Jul 2023 05:07:33 GMT

_Version update only_

## 4.0.5
Tue, 18 Jul 2023 12:21:56 GMT

_Version update only_

## 4.0.4
Wed, 12 Jul 2023 15:50:01 GMT

_Version update only_

## 4.0.3
Mon, 03 Jul 2023 15:28:41 GMT

_Version update only_

## 4.0.2
Wed, 21 Jun 2023 22:04:43 GMT

_Version update only_

## 4.0.1
Wed, 21 Jun 2023 20:29:14 GMT

_Version update only_

## 4.0.0
Mon, 22 May 2023 15:34:14 GMT

### Updates

- Fixed improper use of `ISchemaLocater` interface
- Remove `handleInstancesPolymorphically` from `ContentInstancesOfSpecificClassesSpecification`
- Update to eslint@8
- Add deprecation attributes to `Ruleset.schema.json`
- Promote `PropertyInfo.kindOfQuantity` to `@public`
- Added new `applyOnNestedContent` attribute on content modifier
- Added `Format` lookup in `ECSchema` for formatting properties with `KindOfQuantity`
- Added peer dependency `@itwin/ecschema-metadata`
- Add `HierarchyRequestOptions.sizeLimit` attribute to support hierarchy level size limiting
- Promoted some `@internal` APIs to `@public`.
- Cleaned up localizable strings
- Promote `LabelDefinition` APIs to `@public`.
- Added `PropertyFormatter` for formatting property values in `Content`
- Change RPC requests' timeout handling - instead of repeating 5 times, repeat for a specified amount of time (10 minutes by default)
- Removed unused Update related types
- Added `ContentPropertyValuesFormatter` for content values' formatting on either frontend or backend
- Fix `@deprecated` messages

## 3.8.0
Fri, 08 Dec 2023 15:23:59 GMT

_Version update only_

## 3.7.17
Mon, 20 Nov 2023 18:24:23 GMT

_Version update only_

## 3.7.16
Mon, 16 Oct 2023 12:49:08 GMT

_Version update only_

## 3.7.15
Tue, 10 Oct 2023 19:58:35 GMT

_Version update only_

## 3.7.14
Fri, 29 Sep 2023 16:57:16 GMT

_Version update only_

## 3.7.13
Tue, 08 Aug 2023 19:49:18 GMT

_Version update only_

## 3.7.12
Thu, 27 Jul 2023 21:50:57 GMT

_Version update only_

## 3.7.11
Tue, 11 Jul 2023 17:17:22 GMT

_Version update only_

## 3.7.10
Wed, 05 Jul 2023 13:41:21 GMT

_Version update only_

## 3.7.9
Tue, 20 Jun 2023 12:51:02 GMT

_Version update only_

## 3.7.8
Thu, 01 Jun 2023 17:00:39 GMT

_Version update only_

## 3.7.7
Wed, 24 May 2023 17:27:09 GMT

_Version update only_

## 3.7.6
Mon, 15 May 2023 18:23:41 GMT

_Version update only_

## 3.7.5
Thu, 04 May 2023 19:43:18 GMT

_Version update only_

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

### Updates

- Fix `@deprecated` messages

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

- API promotions
- Deprecate a number of `{api_name}JSON` interfaces in favor of sibling `{api_name}` interface
- Take `InstanceFilterDefinition` instead of pure string ECExpression for hierarchy level filter
- Allow specifying enum values in presentation rules as strings
- Add APIs to get hierarchy level descriptor
- Introduce unfilterable nodes and hierarchy levels
- React to RPC deprecations.

## 3.5.6
Fri, 24 Feb 2023 16:02:47 GMT

_Version update only_

## 3.5.5
Thu, 26 Jan 2023 22:53:28 GMT

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

- Renamed content descriptor property 'filterExpression' to 'fieldsFilterExpression'
- Added InstanceFilterDefinition
- Remove uses of `__dirname`, which is not available in ESM context.
- Add support for old `KeySetJSON` format which used uncompressed IDs.

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

_Version update only_

## 3.4.3
Fri, 28 Oct 2022 13:34:58 GMT

_Version update only_

## 3.4.2
Mon, 24 Oct 2022 13:23:45 GMT

_Version update only_

## 3.4.1
Mon, 17 Oct 2022 20:06:51 GMT

_Version update only_

## 3.4.0
Thu, 13 Oct 2022 20:24:47 GMT

_Version update only_

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
- Add target info to NavigationPropertyInfo
- `PresentationRpcInterface`: Enable response compression for certain operations.

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
Wed, 13 Jul 2022 15:45:53 GMT

_Version update only_

## 3.2.4
Tue, 21 Jun 2022 18:06:33 GMT

_Version update only_

## 3.2.3
Fri, 17 Jun 2022 15:18:39 GMT

_Version update only_

## 3.2.2
Fri, 10 Jun 2022 16:11:37 GMT

### Updates

- Add support for nth level element selection scopes

## 3.2.1
Tue, 07 Jun 2022 15:02:57 GMT

_Version update only_

## 3.2.0
Fri, 20 May 2022 13:10:54 GMT

### Updates

- Deprecated StyleOverrideRule, ImageIdOverrideRule, CheckboxRule and LabelOverrideRule
- Documentation updates.

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

- Deprecate `PropertyGroupingValue`, `PropertyGroup.groupingValue` and `PropertyGroup.sortingValue`.

## 3.0.3
Fri, 25 Mar 2022 15:10:02 GMT

_Version update only_

## 3.0.2
Thu, 10 Mar 2022 21:18:13 GMT

_Version update only_

## 3.0.1
Thu, 24 Feb 2022 15:26:55 GMT

_Version update only_

## 3.0.0
Mon, 24 Jan 2022 14:00:52 GMT

### Updates

- Removed deprecated rules for iModel.js 3.0.
- Upgrade target to ES2019 and deliver both a CommonJs and ESModule version of package
- rename contextId -> iTwinId
- Added 'BaseNodeKey.version' property and 'NodeKey.equals' function to compare keys taking their versions into account.
- rename to @itwin/presentation-common
- Added `excludedClasses` attribute to `ContentInstancesOfSpecificClassesSpecification` and `InstanceNodesOfSpecificClassesSpecification` specifications.
- Added 'onlyIfNotHandled' property support to all content rule specifications
- Update `SelectClassInfo.pathFromInputToSelectClass` type definition to match reality - the relationship may not always be set.
- Clean up deprecated APIs
- Added API to get properties of all elements.
- Added `getContentSources` RPC to retrieve information about where content for specific types of elements comes from.
- Fixed processing of merged content values under nested content field.
- Remove ability to get multiple element properties over RPC.
- Add `getContentInstanceKeys` RPC to efficiently get content instance keys.
- Remove `priority` attribute from presentation request options type.
- Optimize `KeySetJSON` size by compressing instance IDs.
- Remove `PresentationRpcInterface.loadHierarchy`.
- The `condition` attribute should be defined on both `ChildNodeRule` and `RootNodeRule`.
- Added `ignoreCategories` parameter in `createFieldHierarchies` function for adding all of the nested properties to parent field's child fields without considering categories. 
- Removed `PresentationUnitSystem`  in favor of `UnitSystemKey` from `@itwin/core-quantity`.
- remove ClientRequestContext.current

## 2.19.28
Wed, 12 Jan 2022 14:52:38 GMT

_Version update only_

## 2.19.27
Wed, 05 Jan 2022 20:07:20 GMT

_Version update only_

## 2.19.26
Wed, 08 Dec 2021 20:54:53 GMT

_Version update only_

## 2.19.25
Fri, 03 Dec 2021 20:05:49 GMT

_Version update only_

## 2.19.24
Mon, 29 Nov 2021 18:44:31 GMT

_Version update only_

## 2.19.23
Mon, 22 Nov 2021 20:41:40 GMT

_Version update only_

## 2.19.22
Wed, 17 Nov 2021 01:23:26 GMT

_Version update only_

## 2.19.21
Wed, 10 Nov 2021 10:58:24 GMT

_Version update only_

## 2.19.20
Fri, 29 Oct 2021 16:14:22 GMT

_Version update only_

## 2.19.19
Mon, 25 Oct 2021 16:16:25 GMT

_Version update only_

## 2.19.18
Thu, 21 Oct 2021 20:59:44 GMT

_Version update only_

## 2.19.17
Thu, 14 Oct 2021 21:19:43 GMT

_Version update only_

## 2.19.16
Mon, 11 Oct 2021 17:37:46 GMT

_Version update only_

## 2.19.15
Fri, 08 Oct 2021 16:44:23 GMT

_Version update only_

## 2.19.14
Fri, 01 Oct 2021 13:07:03 GMT

_Version update only_

## 2.19.13
Tue, 21 Sep 2021 21:06:40 GMT

_Version update only_

## 2.19.12
Wed, 15 Sep 2021 18:06:46 GMT

### Updates

- Fixed processing of merged content values under nested content field.

## 2.19.11
Thu, 09 Sep 2021 21:04:58 GMT

_Version update only_

## 2.19.10
Wed, 08 Sep 2021 14:36:01 GMT

_Version update only_

## 2.19.9
Wed, 25 Aug 2021 15:36:01 GMT

_Version update only_

## 2.19.8
Mon, 23 Aug 2021 13:23:13 GMT

_Version update only_

## 2.19.7
Fri, 20 Aug 2021 17:47:22 GMT

_Version update only_

## 2.19.6
Tue, 17 Aug 2021 20:34:29 GMT

_Version update only_

## 2.19.5
Fri, 13 Aug 2021 21:48:09 GMT

_Version update only_

## 2.19.4
Thu, 12 Aug 2021 13:09:26 GMT

_Version update only_

## 2.19.3
Wed, 04 Aug 2021 20:29:34 GMT

_Version update only_

## 2.19.2
Tue, 03 Aug 2021 18:26:23 GMT

_Version update only_

## 2.19.1
Thu, 29 Jul 2021 20:01:11 GMT

_Version update only_

## 2.19.0
Mon, 26 Jul 2021 12:21:25 GMT

### Updates

- Stop delivering pseudo-localized strings
- Provide more information on removed nodes in hierarchy comparison results.
- Added conmpressed interfaces for `DescriptorJSON` and ways to handle them.
- Add `RelatedPropertiesSpecification.skipIfDuplicate` attribute
- Add a way to display related properties without a special related class category

## 2.18.4
Tue, 10 Aug 2021 19:35:13 GMT

_Version update only_

## 2.18.3
Wed, 28 Jul 2021 17:16:30 GMT

_Version update only_

## 2.18.2
Mon, 26 Jul 2021 16:18:31 GMT

_Version update only_

## 2.18.1
Fri, 16 Jul 2021 17:45:09 GMT

_Version update only_

## 2.18.0
Fri, 09 Jul 2021 18:11:24 GMT

### Updates

- Promote `PresentationUnitSystem` to @beta
- Expose helper APIs to traverse presentation content.

## 2.17.3
Mon, 26 Jul 2021 16:08:36 GMT

_Version update only_

## 2.17.2
Thu, 08 Jul 2021 15:23:00 GMT

_Version update only_

## 2.17.1
Fri, 02 Jul 2021 15:38:31 GMT

_Version update only_

## 2.17.0
Mon, 28 Jun 2021 16:20:11 GMT

### Updates

- Added ability to associate content items with given input keys.
- Added `relationshipMeaning` property to `NestedContentField`
- Send `Id64[]` ruleset variables as `CompressedId64Set`
- Introduce `Ruleset.version` attribute.

## 2.16.10
Thu, 22 Jul 2021 20:23:45 GMT

_Version update only_

## 2.16.9
Tue, 06 Jul 2021 22:08:34 GMT

_Version update only_

## 2.16.8
Fri, 02 Jul 2021 17:40:46 GMT

_Version update only_

## 2.16.7
Mon, 28 Jun 2021 18:13:04 GMT

_Version update only_

## 2.16.6
Mon, 28 Jun 2021 13:12:55 GMT

_Version update only_

## 2.16.5
Fri, 25 Jun 2021 16:03:01 GMT

_Version update only_

## 2.16.4
Wed, 23 Jun 2021 17:09:07 GMT

_Version update only_

## 2.16.3
Wed, 16 Jun 2021 20:29:32 GMT

_Version update only_

## 2.16.2
Thu, 03 Jun 2021 18:08:11 GMT

_Version update only_

## 2.16.1
Thu, 27 May 2021 20:04:22 GMT

_Version update only_

## 2.16.0
Mon, 24 May 2021 15:58:39 GMT

### Updates

- Add `requiredSchemas` attribute to `Ruleset`
- Add `PropertyCategorySpecification.parentId` attribute` to support custom categories nesting.
- Added `diagnostics` attribute to all presentation requests' props.
- Call given diagnostics handler with diagnostics data whenever response has any.
- Add `propertySource` attribute to `InstanceLabelOverridePropertyValueSpecification` to allow picking property from a related instance.
- Add a new `InstanceLabelOverrideRelatedInstanceLabelSpecification` to allow picking label of a related instance.
- Release tags' review
- Introduce `requiredSchemas` attribute for presentation rules
- Add support for custom property category renderers.

## 2.15.6
Wed, 26 May 2021 15:55:19 GMT

_Version update only_

## 2.15.5
Thu, 20 May 2021 15:06:26 GMT

_Version update only_

## 2.15.4
Tue, 18 May 2021 21:59:07 GMT

_Version update only_

## 2.15.3
Mon, 17 May 2021 13:31:38 GMT

_Version update only_

## 2.15.2
Wed, 12 May 2021 18:08:13 GMT

_Version update only_

## 2.15.1
Wed, 05 May 2021 13:18:31 GMT

_Version update only_

## 2.15.0
Fri, 30 Apr 2021 12:36:58 GMT

### Updates

- Change `Field` type guards to return boolean
- Added new HierarchyUpdateRecord type
- Disable hierarchy preloading

## 2.14.4
Thu, 22 Apr 2021 21:07:33 GMT

_Version update only_

## 2.14.3
Thu, 15 Apr 2021 15:13:16 GMT

_Version update only_

## 2.14.2
Thu, 08 Apr 2021 14:30:09 GMT

_Version update only_

## 2.14.1
Mon, 05 Apr 2021 16:28:00 GMT

_Version update only_

## 2.14.0
Fri, 02 Apr 2021 13:18:42 GMT

### Updates

- Added 'updateHierarchyState' to PresentationIpcInterface
- Added PresentationIpcInterface
- Added an `extendedType` attribute to `PropertyInfo` interface.

## 2.13.0
Tue, 09 Mar 2021 20:28:13 GMT

### Updates

- Added HierarchyCompareInfo object that describes hierarchy changes and next step from which comparison should be continued.
- Updated to use TypeScript 4.1
- begin rename project from iModel.js to iTwin.js

## 2.12.3
Mon, 08 Mar 2021 15:32:00 GMT

_Version update only_

## 2.12.2
Wed, 03 Mar 2021 18:48:53 GMT

_Version update only_

## 2.12.1
Tue, 23 Feb 2021 20:54:45 GMT

_Version update only_

## 2.12.0
Thu, 18 Feb 2021 22:10:13 GMT

### Updates

- Add iModel key to UpdateInfo object.

## 2.11.2
Thu, 18 Feb 2021 02:50:59 GMT

_Version update only_

## 2.11.1
Thu, 04 Feb 2021 17:22:41 GMT

_Version update only_

## 2.11.0
Thu, 28 Jan 2021 13:39:27 GMT

### Updates

- Include all properties into properties field descriptor to make descriptor match any field that has at least one of those properties
- Updated class names in `KeySet` to be case-insensitive
- Added 'activeFormat' property on 'KindOfQuantityInfo' interface.
- Add class information to navigation properties
- Repeat RPC requests when unknown failures happen

## 2.10.3
Fri, 08 Jan 2021 18:34:03 GMT

_Version update only_

## 2.10.2
Fri, 08 Jan 2021 14:52:02 GMT

_Version update only_

## 2.10.1
Tue, 22 Dec 2020 00:53:38 GMT

_Version update only_

## 2.10.0
Fri, 18 Dec 2020 18:24:01 GMT

### Updates

- Include actual primary class ids for nested content fields
- Add support for custom property value renderers

## 2.9.9
Sun, 13 Dec 2020 19:00:03 GMT

_Version update only_

## 2.9.8
Fri, 11 Dec 2020 02:57:36 GMT

_Version update only_

## 2.9.7
Wed, 09 Dec 2020 20:58:23 GMT

_Version update only_

## 2.9.6
Mon, 07 Dec 2020 18:40:48 GMT

_Version update only_

## 2.9.5
Sat, 05 Dec 2020 01:55:56 GMT

### Updates

- Repeat RPC requests when unknown failures happen

## 2.9.4
Wed, 02 Dec 2020 20:55:40 GMT

### Updates

- Include actual primary class ids for nested content fields

## 2.9.3
Mon, 23 Nov 2020 20:57:56 GMT

_Version update only_

## 2.9.2
Mon, 23 Nov 2020 15:33:50 GMT

_Version update only_

## 2.9.1
Thu, 19 Nov 2020 17:03:42 GMT

_Version update only_

## 2.9.0
Wed, 18 Nov 2020 16:01:50 GMT

### Updates

- Add `handlePropertiesPolymorphically` attribute to `ContentInstancesOfSpecificClasses` specification.
- Support getting distinct values for x-to-many related properties

## 2.8.1
Tue, 03 Nov 2020 00:33:56 GMT

_Version update only_

## 2.8.0
Fri, 23 Oct 2020 17:04:02 GMT

### Updates

- Add diagnostics-related types
- Add `KeySet.some` method
- Do not hide grouping nodes when `hideNodesInHierarchy` is specified in hierarchy specification
- Do not duplicate nodes when traversing from node that merges multiple instances from the 'many' side of relationship
- Add support for specifying "*" and property overrides in `RelatedPropertiesSpecification.properties`
- Ruleset creation fails for (0, 0) 2D point

## 2.7.6
Wed, 11 Nov 2020 16:28:23 GMT

_Version update only_

## 2.7.5
Fri, 23 Oct 2020 16:23:50 GMT

_Version update only_

## 2.7.4
Mon, 19 Oct 2020 17:57:02 GMT

_Version update only_

## 2.7.3
Wed, 14 Oct 2020 17:00:59 GMT

_Version update only_

## 2.7.2
Tue, 13 Oct 2020 18:20:39 GMT

_Version update only_

## 2.7.1
Thu, 08 Oct 2020 13:04:35 GMT

### Updates

- Ruleset creation fails for (0, 0) 2D point

## 2.7.0
Fri, 02 Oct 2020 18:03:32 GMT

### Updates

- Added a new `DefaultPropertyCategoryOverride` rule
- Separate polymorphism of relationship and target class
- Allow requesting distinct content values with `DescriptorOverrides` rather than descriptor itself
- Changes to `DescriptorOverrides`: deprecated `sortingFieldName` and `sortDirection` in favor of `sorting` attribute, deprecated `hiddenFieldNames` in favor of `fieldsSelector`. The latter now also allows exclusively including fields.
- Made some fields of `Descriptor` and `DescriptorSource` readonly. They were never intended to be changed, so now we make that clear.

## 2.6.5
Sat, 26 Sep 2020 16:06:34 GMT

_Version update only_

## 2.6.4
Tue, 22 Sep 2020 17:40:07 GMT

_Version update only_

## 2.6.3
Mon, 21 Sep 2020 14:47:10 GMT

_Version update only_

## 2.6.2
Mon, 21 Sep 2020 13:07:44 GMT

_Version update only_

## 2.6.1
Fri, 18 Sep 2020 13:15:09 GMT

_Version update only_

## 2.6.0
Thu, 17 Sep 2020 13:16:12 GMT

### Updates

- Moved ESLint configuration to a plugin

## 2.5.5
Wed, 02 Sep 2020 17:42:23 GMT

_Version update only_

## 2.5.4
Fri, 28 Aug 2020 15:34:15 GMT

_Version update only_

## 2.5.3
Wed, 26 Aug 2020 11:46:00 GMT

_Version update only_

## 2.5.2
Tue, 25 Aug 2020 22:09:08 GMT

_Version update only_

## 2.5.1
Mon, 24 Aug 2020 18:13:04 GMT

_Version update only_

## 2.5.0
Thu, 20 Aug 2020 20:57:10 GMT

### Updates

- Add ability to compare hierarchies based on ruleset variables.
- Made it clear that property grouping nodes might be grouping by multiple raw values.
- Switch to ESLint

## 2.4.2
Fri, 14 Aug 2020 16:34:09 GMT

_Version update only_

## 2.4.1
Fri, 07 Aug 2020 19:57:43 GMT

_Version update only_

## 2.4.0
Tue, 28 Jul 2020 16:26:24 GMT

### Updates

- Add `suppressSimilarAncestorsCheck` hierarchy specifications attribute.
- Add RPC methods that enforce maximum page size, deprecate the old ones.

## 2.3.3
Thu, 23 Jul 2020 12:57:15 GMT

_Version update only_

## 2.3.2
Tue, 14 Jul 2020 23:50:36 GMT

_Version update only_

## 2.3.1
Mon, 13 Jul 2020 18:50:14 GMT

_Version update only_

## 2.3.0
Fri, 10 Jul 2020 17:23:14 GMT

### Updates

- geometry clip containment
-  Add ability to request distinct values in pages using field descriptors
- Deprecate `LoggingNamespaces` enum in favor of package-specific enums.
- Add support for nested property categories

## 2.2.1
Tue, 07 Jul 2020 14:44:52 GMT

_Version update only_

## 2.2.0
Fri, 19 Jun 2020 14:10:03 GMT

_Version update only_

## 2.1.0
Thu, 28 May 2020 22:48:59 GMT

### Updates

- Fix assets not being found on backend when webpacked

## 2.0.0
Wed, 06 May 2020 13:17:49 GMT

### Updates

- Clean up deprecated APIs
- Use label definitions instead of plain string in Nodes and Content Items
- Move some @beta APIs to @public
- Added doNotHideOtherPropertiesOnDisplayOverride flag which controls display override behavior for hiding other properties
- Make sure localization files are included in the package
- Fix release tags of various JSON types
- Separate tests from source
- Add ability to set active units system for property values formatting
- Add RPC interface for comparing hierarchies
- Upgrade to Rush 5.23.2
- Remove support for the iModel.js module system by no longer delivering modules.

## 1.14.1
Wed, 22 Apr 2020 19:04:00 GMT

### Updates

- Documentation

## 1.14.0
Tue, 31 Mar 2020 15:44:19 GMT

_Version update only_

## 1.13.0
Wed, 04 Mar 2020 16:16:31 GMT

_Version update only_

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

_Version update only_

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

_Version update only_

## 1.6.0
Wed, 09 Oct 2019 20:28:42 GMT

_Version update only_

## 1.5.0
Mon, 30 Sep 2019 22:28:48 GMT

### Updates

- Add `PresentationStatus.Canceled` member
- Add ability to force-load all hierarchy with the given imodel and ruleset
- Added autoExpand property to RelatedPropertiesSpecification and NestedContentField
- Add module descriptions
- Added Ruleset and Ruleset variables to request options to support stateless presentation backend
- Store navigation property classes separate from related property paths
- Upgrade to TypeScript 3.6.2

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

_Version update only_

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
- Upgrade to TypeScript 3.2.2

## 0.188.0
Wed, 16 Jan 2019 16:36:09 GMT

_Version update only_

## 0.187.0
Tue, 15 Jan 2019 15:18:59 GMT

_Version update only_

## 0.186.0
Mon, 14 Jan 2019 23:09:10 GMT

_Version update only_

## 0.185.0
Fri, 11 Jan 2019 18:29:00 GMT

### Updates

- Introduce `groupedInstancesCount` property for grouping node keys
- Add `KeySet.instanceKeysCount` and `KeySet.nodeKeysCount` which are faster versions of `KeySet.instanceKeys.size` and `KeySet.nodeKeys.size`
- Add helper functions to identify type of node key
- Add `getInstancesCount` function to calculate total number of instances included in a `KeySet`

## 0.184.0
Thu, 10 Jan 2019 22:46:17 GMT

_Version update only_

## 0.183.0
Mon, 07 Jan 2019 21:49:21 GMT

_Version update only_

## 0.182.0
Mon, 07 Jan 2019 13:31:34 GMT

_Version update only_

## 0.181.0
Fri, 04 Jan 2019 13:02:40 GMT

_Version update only_

## 0.180.0
Wed, 02 Jan 2019 15:18:23 GMT

_Version update only_

## 0.179.0
Wed, 19 Dec 2018 18:26:14 GMT

### Updates

- Invert `isSelectable` property to `isSelectionDisabled` so in the most common case (selectable = true) we don't have to send the value

## 0.178.0
Thu, 13 Dec 2018 22:06:10 GMT

_Version update only_

## 0.177.0
Wed, 12 Dec 2018 17:21:31 GMT

_Version update only_

## 0.176.0
Mon, 10 Dec 2018 21:19:45 GMT

### Updates

- React to signature change for RpcInterface.forward

## 0.175.0
Mon, 10 Dec 2018 17:08:55 GMT

_Version update only_

## 0.174.0
Mon, 10 Dec 2018 13:24:09 GMT

### Updates

- Remove unused dependencies, add `build:watch` script

## 0.173.0
Thu, 06 Dec 2018 22:03:29 GMT

_Version update only_

## 0.172.0
Tue, 04 Dec 2018 17:24:39 GMT

### Updates

- Changed index file name to match package name, eliminate subdirectory index files, decrease usage of default exports, change imports to use other packages' index file.

## 0.171.0
Mon, 03 Dec 2018 18:52:58 GMT

_Version update only_

## 0.170.0
Mon, 26 Nov 2018 19:38:42 GMT

_Version update only_

## 0.169.0
Tue, 20 Nov 2018 16:17:15 GMT

_Version update only_

## 0.168.0
Sat, 17 Nov 2018 14:20:11 GMT

_Version update only_

## 0.167.0
Fri, 16 Nov 2018 21:45:44 GMT

_Version update only_

## 0.166.0
Mon, 12 Nov 2018 16:42:10 GMT

_Version update only_

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

_Version update only_

## 0.162.0
Wed, 24 Oct 2018 19:20:06 GMT

### Updates

- Fix value deserialization when values were not set (null vs undefined)
- Hide internal types from declarations and docs

## 0.161.0
Fri, 19 Oct 2018 13:04:14 GMT

_Version update only_

## 0.160.0
Wed, 17 Oct 2018 18:18:38 GMT

_Version update only_

## 0.159.0
Tue, 16 Oct 2018 14:09:09 GMT

_Version update only_

## 0.158.0
Mon, 15 Oct 2018 19:36:09 GMT

_Version update only_

## 0.157.0
Sun, 14 Oct 2018 17:20:06 GMT

### Updates

- Fixing scripts for linux

## 0.156.0
Fri, 12 Oct 2018 23:00:10 GMT

### Updates

- Initial release

