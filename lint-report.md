# Rush Lint Error Report

Generated on: 2025-12-09T18:29:05.941Z

## Summary

- **Total Errors:** 87
- **Total Warnings:** 320
- **Packages with Issues:** 34
- **Unique Lint Rules Violated:** 5

---

## Lint Rules Summary

| Rule | Errors | Warnings | Total |
|------|--------|----------|-------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 251 | 251 |
| `@typescript-eslint/no-deprecated` | 75 | 0 | 75 |
| `@typescript-eslint/restrict-template-expressions` | 0 | 65 | 65 |
| `@typescript-eslint/await-thenable` | 12 | 0 | 12 |
| `eslint-directive-unused` | 0 | 4 | 4 |

---

## Errors and Warnings by Package

### @itwin/presentation-common

**Errors:** 41 | **Warnings:** 0

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-deprecated` | 41 | 0 |

#### Detailed Errors

| File | Line | Rule | Message |
|------|------|------|---------|
| `src/presentation-common.ts` | 55 | `@typescript-eslint/no-deprecated` | 'HierarchyRequestOptions' is deprecated. in 5.2 - will not b... |
| `src/presentation-common.ts` | 56 | `@typescript-eslint/no-deprecated` | 'HierarchyLevelDescriptorRequestOptions' is deprecated. in 5... |
| `src/presentation-common.ts` | 57 | `@typescript-eslint/no-deprecated` | 'FilterByInstancePathsHierarchyRequestOptions' is deprecated... |
| `src/presentation-common.ts` | 58 | `@typescript-eslint/no-deprecated` | 'FilterByTextHierarchyRequestOptions' is deprecated. in 5.2 ... |
| `src/presentation-common.ts` | 63 | `@typescript-eslint/no-deprecated` | 'ElementPropertiesRequestOptions' is deprecated. in 4.4.0 - ... |
| `src/presentation-common.ts` | 71 | `@typescript-eslint/no-deprecated` | 'SelectionScopeRequestOptions' is deprecated. in 5.0 - will ... |
| `src/presentation-common.ts` | 72 | `@typescript-eslint/no-deprecated` | 'ComputeSelectionRequestOptions' is deprecated. in 5.0 - wil... |
| `src/presentation-common.ts` | 73 | `@typescript-eslint/no-deprecated` | 'HierarchyCompareOptions' is deprecated. in 5.2 - will not b... |
| `src/presentation-common.ts` | 98 | `@typescript-eslint/no-deprecated` | 'HierarchyUpdateInfo' is deprecated. in 5.2 - will not be re... |
| `src/presentation-common.ts` | 100 | `@typescript-eslint/no-deprecated` | 'PartialHierarchyModification' is deprecated. in 5.2 - will ... |
| `src/presentation-common.ts` | 101 | `@typescript-eslint/no-deprecated` | 'NodeInsertionInfo' is deprecated. in 5.2 - will not be remo... |
| `src/presentation-common.ts` | 102 | `@typescript-eslint/no-deprecated` | 'NodeDeletionInfo' is deprecated. in 5.2 - will not be remov... |
| `src/presentation-common.ts` | 103 | `@typescript-eslint/no-deprecated` | 'NodeUpdateInfo' is deprecated. in 5.2 - will not be removed... |
| `src/presentation-common.ts` | 104 | `@typescript-eslint/no-deprecated` | 'HierarchyCompareInfo' is deprecated. in 5.2 - will not be r... |
| `src/presentation-common.ts` | 114 | `@typescript-eslint/no-deprecated` | 'UnitSystemFormat' is deprecated. in 5.1 - will not be remov... |
| `src/presentation-common.ts` | 114 | `@typescript-eslint/no-deprecated` | 'FormatsMap' is deprecated. in 5.1 - will not be removed unt... |
| `src/presentation-common.ts` | 128 | `@typescript-eslint/no-deprecated` | 'HierarchyRpcRequestOptions' is deprecated. in 5.2 - will no... |
| `src/presentation-common.ts` | 129 | `@typescript-eslint/no-deprecated` | 'HierarchyLevelDescriptorRpcRequestOptions' is deprecated. i... |
| `src/presentation-common.ts` | 130 | `@typescript-eslint/no-deprecated` | 'FilterByInstancePathsHierarchyRpcRequestOptions' is depreca... |
| `src/presentation-common.ts` | 131 | `@typescript-eslint/no-deprecated` | 'FilterByTextHierarchyRpcRequestOptions' is deprecated. in 5... |
| `src/presentation-common.ts` | 141 | `@typescript-eslint/no-deprecated` | 'SelectionScopeRpcRequestOptions' is deprecated. in 5.0 - wi... |
| `src/presentation-common.ts` | 142 | `@typescript-eslint/no-deprecated` | 'ComputeSelectionRpcRequestOptions' is deprecated. in 5.0 - ... |
| `src/presentation-common.ts` | 152 | `@typescript-eslint/no-deprecated` | 'SelectionScope' is deprecated. in 5.0 - will not be removed... |
| `src/presentation-common.ts` | 152 | `@typescript-eslint/no-deprecated` | 'ElementSelectionScopeProps' is deprecated. in 5.0 - will no... |
| `src/presentation-common.ts` | 152 | `@typescript-eslint/no-deprecated` | 'SelectionScopeProps' is deprecated. in 5.0 - will not be re... |
| `src/presentation-common.ts` | 226 | `@typescript-eslint/no-deprecated` | 'traverseContent' is deprecated. in 5.4 - will not be remove... |
| `src/presentation-common.ts` | 227 | `@typescript-eslint/no-deprecated` | 'traverseContentItem' is deprecated. in 5.4 - will not be re... |
| `src/presentation-common.ts` | 254 | `@typescript-eslint/no-deprecated` | 'HierarchyLevel' is deprecated. in 5.2 - will not be removed... |
| `src/presentation-common.ts` | 256 | `@typescript-eslint/no-deprecated` | 'StandardNodeTypes' is deprecated. in 5.2 - will not be remo... |
| `src/presentation-common.ts` | 257 | `@typescript-eslint/no-deprecated` | 'NodeKey' is deprecated. in 5.2 - will not be removed until ... |
| `src/presentation-common.ts` | 258 | `@typescript-eslint/no-deprecated` | 'NodeKeyPath' is deprecated. in 5.2 - will not be removed un... |
| `src/presentation-common.ts` | 259 | `@typescript-eslint/no-deprecated` | 'BaseNodeKey' is deprecated. in 5.2 - will not be removed un... |
| `src/presentation-common.ts` | 260 | `@typescript-eslint/no-deprecated` | 'ECInstancesNodeKey' is deprecated. in 5.2 - will not be rem... |
| `src/presentation-common.ts` | 261 | `@typescript-eslint/no-deprecated` | 'GroupingNodeKey' is deprecated. in 5.2 - will not be remove... |
| `src/presentation-common.ts` | 262 | `@typescript-eslint/no-deprecated` | 'ECClassGroupingNodeKey' is deprecated. in 5.2 - will not be... |
| `src/presentation-common.ts` | 263 | `@typescript-eslint/no-deprecated` | 'ECPropertyGroupingNodeKey' is deprecated. in 5.2 - will not... |
| `src/presentation-common.ts` | 264 | `@typescript-eslint/no-deprecated` | 'LabelGroupingNodeKey' is deprecated. in 5.2 - will not be r... |
| `src/presentation-common.ts` | 272 | `@typescript-eslint/no-deprecated` | 'Node' is deprecated. in 5.2 - will not be removed until aft... |
| `src/presentation-common.ts` | 272 | `@typescript-eslint/no-deprecated` | 'PartialNode' is deprecated. in 5.2 - will not be removed un... |
| `src/presentation-common.ts` | 273 | `@typescript-eslint/no-deprecated` | 'NodePathElement' is deprecated. in 5.2 - will not be remove... |
| `src/presentation-common.ts` | 273 | `@typescript-eslint/no-deprecated` | 'NodePathFilteringData' is deprecated. in 5.2 - will not be ... |

---

### @itwin/presentation-frontend

**Errors:** 20 | **Warnings:** 0

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-deprecated` | 20 | 0 |

#### Detailed Errors

| File | Line | Rule | Message |
|------|------|------|---------|
| `src/presentation-frontend.ts` | 13 | `@typescript-eslint/no-deprecated` | 'IModelHierarchyChangeEventArgs' is deprecated. in 5.2 - wil... |
| `src/presentation-frontend.ts` | 16 | `@typescript-eslint/no-deprecated` | 'GetNodesRequestOptions' is deprecated. in 5.2 - will not be... |
| `src/presentation-frontend.ts` | 53 | `@typescript-eslint/no-deprecated` | 'SelectionChangesListener' is deprecated. in 5.0 - will not ... |
| `src/presentation-frontend.ts` | 54 | `@typescript-eslint/no-deprecated` | 'SelectionChangeEvent' is deprecated. in 5.0 - will not be r... |
| `src/presentation-frontend.ts` | 55 | `@typescript-eslint/no-deprecated` | 'SelectionChangeType' is deprecated. in 5.0 - will not be re... |
| `src/presentation-frontend.ts` | 56 | `@typescript-eslint/no-deprecated` | 'SelectionChangeEventArgs' is deprecated. in 5.0 - will not ... |
| `src/presentation-frontend.ts` | 58 | `@typescript-eslint/no-deprecated` | 'ISelectionProvider' is deprecated. in 5.0 - will not be rem... |
| `src/presentation-frontend.ts` | 59 | `@typescript-eslint/no-deprecated` | 'SelectionManagerProps' is deprecated. in 5.0 - will not be ... |
| `src/presentation-frontend.ts` | 59 | `@typescript-eslint/no-deprecated` | 'SelectionManager' is deprecated. in 5.0 - will not be remov... |
| `src/presentation-frontend.ts` | 60 | `@typescript-eslint/no-deprecated` | 'SelectionScopesManagerProps' is deprecated. in 5.0 - will n... |
| `src/presentation-frontend.ts` | 60 | `@typescript-eslint/no-deprecated` | 'SelectionScopesManager' is deprecated. in 5.0 - will not be... |
| `src/presentation-frontend.ts` | 60 | `@typescript-eslint/no-deprecated` | 'createSelectionScopeProps' is deprecated. in 5.0 - will not... |
| `src/presentation-frontend.ts` | 61 | `@typescript-eslint/no-deprecated` | 'SelectionHandlerProps' is deprecated. in 5.0 - will not be ... |
| `src/presentation-frontend.ts` | 61 | `@typescript-eslint/no-deprecated` | 'SelectionHandler' is deprecated. in 5.0 - will not be remov... |
| `src/presentation-frontend.ts` | 62 | `@typescript-eslint/no-deprecated` | 'HiliteSet' is deprecated. in 5.0 - will not be removed unti... |
| `src/presentation-frontend.ts` | 62 | `@typescript-eslint/no-deprecated` | 'HiliteSetProviderProps' is deprecated. in 5.0 - will not be... |
| `src/presentation-frontend.ts` | 62 | `@typescript-eslint/no-deprecated` | 'HiliteSetProvider' is deprecated. in 5.0 - will not be remo... |
| `src/presentation-frontend.ts` | 63 | `@typescript-eslint/no-deprecated` | 'SelectionHelper' is deprecated. in 5.0 - will not be remove... |
| `presentation-frontend/PresentationManager.ts` | 121 | `@typescript-eslint/no-deprecated` | 'HierarchyRequestOptions' is deprecated. in 5.2 - will not b... |
| `presentation-frontend/PresentationManager.ts` | 121 | `@typescript-eslint/no-deprecated` | 'NodeKey' is deprecated. in 5.2 - will not be removed until ... |

---

### @itwin/presentation-backend

**Errors:** 9 | **Warnings:** 0

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-deprecated` | 9 | 0 |

#### Detailed Errors

| File | Line | Rule | Message |
|------|------|------|---------|
| `src/presentation-backend.ts` | 11 | `@typescript-eslint/no-deprecated` | 'MultiManagerPresentationProps' is deprecated. in 4.8 - will... |
| `src/presentation-backend.ts` | 11 | `@typescript-eslint/no-deprecated` | 'SingleManagerPresentationProps' is deprecated. in 4.8 - wil... |
| `src/presentation-backend.ts` | 13 | `@typescript-eslint/no-deprecated` | 'HierarchyCacheMode' is deprecated. in 5.2 - will not be rem... |
| `src/presentation-backend.ts` | 14 | `@typescript-eslint/no-deprecated` | 'HierarchyCacheConfig' is deprecated. in 5.2 - will not be r... |
| `src/presentation-backend.ts` | 15 | `@typescript-eslint/no-deprecated` | 'MemoryHierarchyCacheConfig' is deprecated. in 5.2 - will no... |
| `src/presentation-backend.ts` | 16 | `@typescript-eslint/no-deprecated` | 'DiskHierarchyCacheConfig' is deprecated. in 5.2 - will not ... |
| `src/presentation-backend.ts` | 17 | `@typescript-eslint/no-deprecated` | 'HybridCacheConfig' is deprecated. in 5.2 - will not be remo... |
| `src/presentation-backend.ts` | 20 | `@typescript-eslint/no-deprecated` | 'UnitSystemFormat' is deprecated. in 4.3 - will not be remov... |
| `presentation-backend/PresentationManager.ts` | 232 | `@typescript-eslint/no-deprecated` | 'CommonUnitSystemFormat' is deprecated. in 5.1 - will not be... |

---

### @itwin/core-backend

**Errors:** 8 | **Warnings:** 0

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/await-thenable` | 8 | 0 |

#### Detailed Errors

| File | Line | Rule | Message |
|------|------|------|---------|
| `ecdb/ECSqlQuery.test.ts` | 678 | `@typescript-eslint/await-thenable` | Unexpected iterable of non-Promise (non-"Thenable") values p... |
| `native/DgnDbWorker.test.ts` | 114 | `@typescript-eslint/await-thenable` | Unexpected iterable of non-Promise (non-"Thenable") values p... |
| `standalone/ChangesetReader.test.ts` | 1059 | `@typescript-eslint/await-thenable` | Unexpected iterable of non-Promise (non-"Thenable") values p... |
| `standalone/ChangesetReader.test.ts` | 1059 | `@typescript-eslint/await-thenable` | Unexpected iterable of non-Promise (non-"Thenable") values p... |
| `standalone/ChangesetReader.test.ts` | 1163 | `@typescript-eslint/await-thenable` | Unexpected iterable of non-Promise (non-"Thenable") values p... |
| `standalone/ChangesetReader.test.ts` | 1163 | `@typescript-eslint/await-thenable` | Unexpected iterable of non-Promise (non-"Thenable") values p... |
| `standalone/ChangesetReader.test.ts` | 1279 | `@typescript-eslint/await-thenable` | Unexpected iterable of non-Promise (non-"Thenable") values p... |
| `standalone/ChangesetReader.test.ts` | 1279 | `@typescript-eslint/await-thenable` | Unexpected iterable of non-Promise (non-"Thenable") values p... |

---

### @itwin/core-common

**Errors:** 4 | **Warnings:** 0

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-deprecated` | 4 | 0 |

#### Detailed Errors

| File | Line | Rule | Message |
|------|------|------|---------|
| `src/EntityProps.ts` | 106 | `@typescript-eslint/no-deprecated` | 'PropertyMetaData' is deprecated. in 5.0 - will not be remov... |
| `internal/cross-package.ts` | 13 | `@typescript-eslint/no-deprecated` | 'BackendReadable' is deprecated. in 3.4.5 - might be removed... |
| `internal/cross-package.ts` | 13 | `@typescript-eslint/no-deprecated` | 'BackendWritable' is deprecated. in 3.4.5 - might be removed... |
| `internal/cross-package.ts` | 13 | `@typescript-eslint/no-deprecated` | 'BackendBuffer' is deprecated. in 3.4.5 - might be removed i... |

---

### backend-integration-tests

**Errors:** 2 | **Warnings:** 19

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 10 |
| `@typescript-eslint/restrict-template-expressions` | 0 | 9 |
| `@typescript-eslint/await-thenable` | 2 | 0 |

#### Detailed Errors

| File | Line | Rule | Message |
|------|------|------|---------|
| `perftest/ChangesetReader.test.ts` | 278 | `@typescript-eslint/await-thenable` | Unexpected iterable of non-Promise (non-"Thenable") values p... |
| `perftest/ChangesetReader.test.ts` | 278 | `@typescript-eslint/await-thenable` | Unexpected iterable of non-Promise (non-"Thenable") values p... |

---

### @itwin/core-frontend

**Errors:** 2 | **Warnings:** 0

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/await-thenable` | 1 | 0 |
| `@typescript-eslint/no-deprecated` | 1 | 0 |

#### Detailed Errors

| File | Line | Rule | Message |
|------|------|------|---------|
| `quantity-formatting/QuantityFormatter.ts` | 816 | `@typescript-eslint/await-thenable` | Unexpected iterable of non-Promise (non-"Thenable") values p... |
| `request/Request.ts` | 108 | `@typescript-eslint/no-deprecated` | 'ProgressInfo' is deprecated. in 4.0 - will not be removed u... |

---

### core-full-stack-tests

**Errors:** 1 | **Warnings:** 24

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 23 |
| `@typescript-eslint/restrict-template-expressions` | 0 | 1 |
| `@typescript-eslint/await-thenable` | 1 | 0 |

#### Detailed Errors

| File | Line | Rule | Message |
|------|------|------|---------|
| `standalone/ECSqlQuery.test.ts` | 142 | `@typescript-eslint/await-thenable` | Unexpected iterable of non-Promise (non-"Thenable") values p... |

---

### @itwin/ecschema-metadata

**Errors:** 0 | **Warnings:** 58

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/restrict-template-expressions` | 0 | 31 |
| `@typescript-eslint/no-non-null-assertion` | 0 | 27 |

---

### @itwin/core-markup

**Errors:** 0 | **Warnings:** 51

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 49 |
| `eslint-directive-unused` | 0 | 2 |

---

### @itwin/ecschema-editing

**Errors:** 0 | **Warnings:** 38

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 35 |
| `@typescript-eslint/restrict-template-expressions` | 0 | 3 |

---

### @itwin/map-layers-formats

**Errors:** 0 | **Warnings:** 24

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 15 |
| `@typescript-eslint/restrict-template-expressions` | 0 | 9 |

---

### display-performance-test-app

**Errors:** 0 | **Warnings:** 17

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 15 |
| `@typescript-eslint/restrict-template-expressions` | 0 | 2 |

---

### @itwin/frontend-devtools

**Errors:** 0 | **Warnings:** 13

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 12 |
| `@typescript-eslint/restrict-template-expressions` | 0 | 1 |

---

### example-code-snippets

**Errors:** 0 | **Warnings:** 10

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 10 |

---

### imodel-from-reality-model

**Errors:** 0 | **Warnings:** 10

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 9 |
| `@typescript-eslint/restrict-template-expressions` | 0 | 1 |

---

### @itwin/ecschema2ts

**Errors:** 0 | **Warnings:** 8

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 8 |

---

### @itwin/certa

**Errors:** 0 | **Warnings:** 7

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 7 |

---

### @itwin/core-quantity

**Errors:** 0 | **Warnings:** 6

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/restrict-template-expressions` | 0 | 6 |

---

### @itwin/core-mobile

**Errors:** 0 | **Warnings:** 5

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 5 |

---

### imodel-from-orbitgt-pointcloud

**Errors:** 0 | **Warnings:** 4

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 3 |
| `@typescript-eslint/restrict-template-expressions` | 0 | 1 |

---

### @itwin/rpcinterface-full-stack-tests

**Errors:** 0 | **Warnings:** 4

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 4 |

---

### @itwin/ecschema-rpcinterface-tests

**Errors:** 0 | **Warnings:** 4

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 4 |

---

### example-code-app

**Errors:** 0 | **Warnings:** 3

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 3 |

---

### export-gltf

**Errors:** 0 | **Warnings:** 2

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 2 |

---

### imodel-from-geojson

**Errors:** 0 | **Warnings:** 2

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 2 |

---

### @itwin/linear-referencing-backend

**Errors:** 0 | **Warnings:** 2

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 2 |

---

### @itwin/core-bentley

**Errors:** 0 | **Warnings:** 2

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `eslint-directive-unused` | 0 | 2 |

---

### @itwin/appui-abstract

**Errors:** 0 | **Warnings:** 2

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 2 |

---

### @itwin/webgl-compatibility

**Errors:** 0 | **Warnings:** 1

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 1 |

---

### @itwin/ecsql-common

**Errors:** 0 | **Warnings:** 1

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/restrict-template-expressions` | 0 | 1 |

---

### @itwin/ecschema-locaters

**Errors:** 0 | **Warnings:** 1

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 1 |

---

### @itwin/core-electron

**Errors:** 0 | **Warnings:** 1

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 1 |

---

### @itwin/build-tools

**Errors:** 0 | **Warnings:** 1

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
| `@typescript-eslint/no-non-null-assertion` | 0 | 1 |

---

