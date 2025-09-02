---
publish: false
---

# NextVersion

- [@itwin/core-ecschema-metadata](#itwincore-ecschema-metadata)
  - [Additions](#additions)
- [Presentation](#presentation)
  - [Deprecation of hierarchy-related APIs](#deprecation-of-hierarchy-related-apis)
- [API deprecations](#api-deprecations)
  - [@itwin/presentation-common](#itwinpresentation-common)
  - [@itwin/presentation-backend](#itwinpresentation-backend)
  - [@itwin/presentation-frontend](#itwinpresentation-frontend)

## @itwin/core-ecschema-metadata

### Additions

- Added [FormatSetFormatsProvider]($ecschema-metadata) class that implements [MutableFormatsProvider]($quantity) to manage format definitions within a format set. This provider supports adding and removing formats at runtime and automatically updates the underlying format set when changes are made.

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
