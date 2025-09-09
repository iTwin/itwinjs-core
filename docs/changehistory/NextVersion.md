---
publish: false
---

# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-ecschema-metadata](#itwincore-ecschema-metadata)
    - [Additions](#additions)
    - [Changes](#changes)
  - [Presentation](#presentation)
    - [Deprecation of hierarchy-related APIs](#deprecation-of-hierarchy-related-apis)
  - [API deprecations](#api-deprecations)
    - [@itwin/presentation-common](#itwinpresentation-common)
    - [@itwin/presentation-backend](#itwinpresentation-backend)
    - [@itwin/presentation-frontend](#itwinpresentation-frontend)

## @itwin/core-ecschema-metadata

### Additions

- Added [FormatSetFormatsProvider]($ecschema-metadata) class that implements [MutableFormatsProvider]($quantity) to manage format definitions within a format set. This provider supports adding and removing formats at runtime and automatically updates the underlying format set when changes are made.

### Changes

- Added  `unitSystem` property to [FormatSet]($ecschema-metadata) interface, using [UnitSystemKey]($quantity) type. This will help move APIs away from relying on `activeUnitSystem` in `quantityFormatter`, as they move to the new formatting APIs using `IModelApp.formatsProvider`. Looking ahead, tools and components that use formatting APIs can then listen to just the `onFormatsChanged` event from `IModelApp.formatsProvider` instead of `IModelApp.quantityFormatter.onActiveUnitSystemChanged`.
- Changed interface for formats in `FormatSet` from [SchemaItemFormatProps]($ecschema-metadata) to [FormatDefinition]($quantity). FormatSet just uses the `name`, `label`, `description` field from `SchemaItemFormatProps`, which `FormatDefinition` already has.
## Presentation

### Deprecation of hierarchy-related APIs

All hierarchies-related APIs have been deprecated in favor of the new-generation hierarchy building APIs, provided with the [`@itwin/presentation-hierarchies` package](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md). See the [learning section](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md#learning) and [migration guide](https://github.com/iTwin/presentation/blob/master/packages/hierarchies/learning/PresentationRulesMigrationGuide.md) for details on how to create similar hierarchies using those APIs. See the [API deprecations](#api-deprecations) section for a list of specific APIs that have been deprecated.

## API deprecations

### @itwin/presentation-common

Deprecated all hierarchy-related types (see [Deprecation of hierarchy-related APIs](#deprecation-of-hierarchy-related-apis) section for more details).

- Presentation rule types:
  - `ChildNodeRule`
  - `ChildNodeSpecification`
  - `ChildNodeSpecificationBase`
  - `ChildNodeSpecificationTypes`
  - `ClassGroup`
  - `CustomNodeSpecification`
  - `CustomQueryInstanceNodesSpecification`
  - `DefaultGroupingPropertiesContainer`
  - `ECPropertyValueQuerySpecification`
  - `GroupingRule`
  - `GroupingSpecification`
  - `GroupingSpecificationBase`
  - `GroupingSpecificationTypes`
  - `InstanceNodesOfSpecificClassesSpecification`
  - `NavigationRule`
  - `NavigationRuleBase`
  - `NodeArtifactsRule`
  - `PropertyGroup`
  - `PropertyRangeGroupSpecification`
  - `QuerySpecification`
  - `QuerySpecificationBase`
  - `QuerySpecificationTypes`
  - `RelatedInstanceNodesSpecification`
  - `RootNodeRule`
  - `SameLabelInstanceGroup`
  - `SameLabelInstanceGroupApplicationStage`
  - `StringQuerySpecification`
  - `SubCondition`
- Node key types:
  - `BaseNodeKey`
  - `ECClassGroupingNodeKey`
  - `ECInstancesNodeKey`
  - `ECPropertyGroupingNodeKey`
  - `GroupingNodeKey`
  - `LabelGroupingNodeKey`
  - `NodeKey`
  - `NodeKeyPath`
  - `KeySet.nodeKeys`, `KeySet.nodeKeysCount`, `KeySetJSON.nodeKeys`
- Node types:
  - `Node`
  - `NodePathElement`
  - `NodePathFilteringData`
  - `PartialNode`
  - `StandardNodeTypes`
- Presentation manager prop and return types:
  - `FilterByInstancePathsHierarchyRequestOptions`
  - `FilterByInstancePathsHierarchyRpcRequestOptions`
  - `FilterByTextHierarchyRequestOptions`
  - `FilterByTextHierarchyRpcRequestOptions`
  - `HierarchyCompareInfo`
  - `HierarchyCompareOptions`
  - `HierarchyLevel`
  - `HierarchyLevelDescriptorRequestOptions`
  - `HierarchyLevelDescriptorRpcRequestOptions`
  - `HierarchyRequestOptions`
  - `HierarchyRpcRequestOptions`
  - `HierarchyUpdateInfo`
  - `NodeDeletionInfo`
  - `NodeInsertionInfo`
  - `NodeUpdateInfo`
  - `PartialHierarchyModification`

### @itwin/presentation-backend

Deprecated all hierarchy-related types (see [Deprecation of hierarchy-related APIs](#deprecation-of-hierarchy-related-apis) section for more details).

- Hierarchy cache configuration:
  - `DiskHierarchyCacheConfig`
  - `HierarchyCacheConfig`
  - `HierarchyCacheMode`
  - `HybridCacheConfig`
  - `MemoryHierarchyCacheConfig`
  - `PresentationManagerCachingConfig.hierarchies`
- `PresentationManager` methods:
  - `PresentationManager.compareHierarchies`
  - `PresentationManager.getFilteredNodePaths`
  - `PresentationManager.getNodePaths`
  - `PresentationManager.getNodes`
  - `PresentationManager.getNodesCount`
  - `PresentationManager.getNodesDescriptor`

### @itwin/presentation-frontend

Deprecated all hierarchy-related types (see [Deprecation of hierarchy-related APIs](#deprecation-of-hierarchy-related-apis) section for more details).

- `GetNodesRequestOptions`
- `IModelHierarchyChangeEventArgs`
- `PresentationManager` methods & members:
  - `PresentationManager.getFilteredNodePaths`
  - `PresentationManager.getNodePaths`
  - `PresentationManager.getNodesCount`
  - `PresentationManager.getNodesDescriptor`
  - `PresentationManager.getNodesIterator`
  - `PresentationManager.onIModelHierarchyChanged`

## Display

### Draco decoding

Draco decoding in iTwin.js has been changed so that the loaders.gl dependency will no longer use a CDN to request the draco-decoder source files. Instead, we now bundle those resources into iTwin.js from a new draco3d dependency. We ask the loaders.gl library to locally use those resources.
