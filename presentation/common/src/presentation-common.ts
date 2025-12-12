/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/**
 * @module Core
 *
 * @docs-group-description Core
 * Common types used all across Presentation packages.
 */
export {
  DiagnosticsLoggerSeverity,
  Diagnostics,
  ClientDiagnostics,
  DiagnosticsOptions,
  ClientDiagnosticsHandler,
  ClientDiagnosticsOptions,
  ClientDiagnosticsAttribute,
  DiagnosticsLogMessage,
  DiagnosticsScopeLogs,
  DiagnosticsLogEntry,
} from "./presentation-common/Diagnostics.js";
export {
  ClassId,
  InstanceId,
  InstanceKey,
  ClassInfo,
  CompressedClassInfoJSON,
  EnumerationChoice,
  EnumerationInfo,
  KindOfQuantityInfo,
  NavigationPropertyInfo,
  NavigationPropertyInfoJSON,
  PropertyInfo,
  PropertyValueConstraints,
  StringPropertyValueConstraints,
  NumericPropertyValueConstraints,
  ArrayPropertyValueConstraints,
  PropertyInfoJSON,
  RelatedClassInfo,
  RelatedClassInfoJSON,
  RelatedClassInfoWithOptionalRelationship,
  RelatedClassInfoWithOptionalRelationshipJSON,
  RelationshipPath,
  RelationshipPathJSON,
  StrippedRelatedClassInfo,
  StrippedRelationshipPath,
} from "./presentation-common/EC.js";
export { PresentationStatus, PresentationError } from "./presentation-common/Error.js";
export { Key, Keys, KeySetJSON, KeySet } from "./presentation-common/KeySet.js";
export { LabelCompositeValue, LabelRawValue, LabelDefinition } from "./presentation-common/LabelDefinition.js";
export {
  RequestOptions,
  RequestOptionsWithRuleset,
  ContentSourcesRequestOptions,
  ContentDescriptorRequestOptions,
  ContentRequestOptions,
  DistinctValuesRequestOptions,
  SingleElementPropertiesRequestOptions,
  MultiElementPropertiesByClassRequestOptions,
  MultiElementPropertiesByIdsRequestOptions,
  MultiElementPropertiesRequestOptions,
  ContentInstanceKeysRequestOptions,
  DisplayLabelRequestOptions,
  DisplayLabelsRequestOptions,
  PageOptions,
  Paged,
  Prioritized,
  WithCancelEvent,
} from "./presentation-common/PresentationManagerOptions.js";
/* eslint-disable @typescript-eslint/no-deprecated */
export {
  HierarchyRequestOptions,
  HierarchyLevelDescriptorRequestOptions,
  FilterByInstancePathsHierarchyRequestOptions,
  FilterByTextHierarchyRequestOptions,
  ElementPropertiesRequestOptions,
  SelectionScopeRequestOptions,
  ComputeSelectionRequestOptions,
  HierarchyCompareOptions,
} from "./presentation-common/PresentationManagerOptions.js";
/* eslint-enable @typescript-eslint/no-deprecated */
export { RegisteredRuleset } from "./presentation-common/RegisteredRuleset.js";
export {
  VariableValueTypes,
  VariableValue,
  VariableValueJSON,
  BooleanRulesetVariable,
  StringRulesetVariable,
  IntRulesetVariable,
  IntsRulesetVariable,
  Id64RulesetVariable,
  Id64sRulesetVariable,
  RulesetVariable,
  Id64sRulesetVariableJSON,
  RulesetVariableJSON,
} from "./presentation-common/RulesetVariables.js";
export { RulesetsFactory, ComputeDisplayValueCallback, PrimitivePropertyValue } from "./presentation-common/RulesetsFactory.js";
export {
  UPDATE_FULL,
  UpdateInfo,
  ContentUpdateInfo,
} from "./presentation-common/Update.js";
export { DEFAULT_KEYS_BATCH_SIZE, Omit, PagedResponse, PartialBy, Subtract, ValuesDictionary, getInstancesCount } from "./presentation-common/Utils.js";
/* eslint-disable @typescript-eslint/no-deprecated */
export {
  HierarchyUpdateInfo,
  PartialHierarchyModification,
  NodeInsertionInfo,
  NodeDeletionInfo,
  NodeUpdateInfo,
  HierarchyCompareInfo,
} from "./presentation-common/Update.js";
/* eslint-enable @typescript-eslint/no-deprecated */
export {
  InstanceFilterDefinition,
  InstanceFilterRelatedInstanceDefinition,
  InstanceFilterRelatedInstancePath,
  InstanceFilterRelatedInstanceTargetAlias,
  InstanceFilterRelatedInstanceRelationshipAlias,
} from "./presentation-common/InstanceFilterDefinition.js";
export { FormatOptions, KoqPropertyValueFormatter } from "./presentation-common/KoqPropertyValueFormatter.js";

/* eslint-disable @typescript-eslint/no-deprecated */
export { UnitSystemFormat, FormatsMap } from "./presentation-common/KoqPropertyValueFormatter.js";
/* eslint-enable @typescript-eslint/no-deprecated */

/**
 * @module RPC
 *
 * @docs-group-description RPC
 * Types used for RPC communication between frontend and backend. Generally should
 * only be used internally by presentation packages.
 */
export {
  PresentationRpcRequestOptions,
  PresentationRpcResponseData,
  RpcDiagnosticsOptions,
  PresentationRpcResponse,
  ContentSourcesRpcRequestOptions,
  ContentSourcesRpcResult,
  ContentDescriptorRpcRequestOptions,
  ContentRpcRequestOptions,
  SingleElementPropertiesRpcRequestOptions,
  DistinctValuesRpcRequestOptions,
  ContentInstanceKeysRpcRequestOptions,
  DisplayLabelRpcRequestOptions,
  DisplayLabelsRpcRequestOptions,
  PresentationRpcInterface,
} from "./presentation-common/PresentationRpcInterface.js";
/* eslint-disable @typescript-eslint/no-deprecated */
export {
  HierarchyRpcRequestOptions,
  HierarchyLevelDescriptorRpcRequestOptions,
  FilterByInstancePathsHierarchyRpcRequestOptions,
  FilterByTextHierarchyRpcRequestOptions,
  SelectionScopeRpcRequestOptions,
  ComputeSelectionRpcRequestOptions,
} from "./presentation-common/PresentationRpcInterface.js";
/* eslint-enable @typescript-eslint/no-deprecated */

/**
 * @module UnifiedSelection
 *
 * @docs-group-description UnifiedSelection
 * Types related to [unified selection]($docs/presentation/unified-selection/index.md).
 */
/* eslint-disable-next-line @typescript-eslint/no-deprecated */
export { SelectionScope, ElementSelectionScopeProps, SelectionScopeProps } from "./presentation-common/selection/SelectionScope.js";

/**
 * @module Content
 *
 * @docs-group-description Content
 * Types related to presentation [content]($docs/presentation/content/index.md).
 */
export { CategoryDescription, CategoryDescriptionJSON } from "./presentation-common/content/Category.js";
export { ContentJSON, Content } from "./presentation-common/content/Content.js";
export {
  SelectClassInfo,
  SelectClassInfoJSON,
  ContentFlags,
  SortDirection,
  SelectionInfo,
  DescriptorJSON,
  DescriptorOverrides,
  DescriptorSource,
  Descriptor,
} from "./presentation-common/content/Descriptor.js";
export { DefaultContentDisplayTypes } from "./presentation-common/content/DisplayTypes.js";
export { EditorDescription } from "./presentation-common/content/Editor.js";
export {
  PropertiesFieldJSON,
  ArrayPropertiesFieldJSON,
  StructPropertiesFieldJSON,
  NestedContentFieldJSON,
  FieldJSON,
  Field,
  PropertiesField,
  ArrayPropertiesField,
  StructPropertiesField,
  NestedContentField,
  FieldDescriptorType,
  FieldDescriptor,
  NamedFieldDescriptor,
  PropertiesFieldDescriptor,
} from "./presentation-common/content/Fields.js";
export { ItemJSON, Item } from "./presentation-common/content/Item.js";
export { PropertyAccessor, PropertyAccessorPath, Property, PropertyJSON } from "./presentation-common/content/Property.js";
export { RendererDescription } from "./presentation-common/content/Renderer.js";
export {
  PropertyValueFormat,
  PrimitiveTypeDescription,
  ArrayTypeDescription,
  StructFieldMemberDescription,
  StructTypeDescription,
  TypeDescription,
} from "./presentation-common/content/TypeDescription.js";
export {
  Value,
  ValuesMap,
  ValuesArray,
  DisplayValue,
  DisplayValuesMap,
  DisplayValuesArray,
  NestedContentValue,
  NavigationPropertyValue,
  DisplayValueGroup,
} from "./presentation-common/content/Value.js";
export {
  FieldHierarchy,
  StartContentProps,
  ProcessFieldHierarchiesProps,
  StartItemProps,
  StartCategoryProps,
  StartFieldProps,
  StartStructProps,
  StartArrayProps,
  ProcessMergedValueProps,
  ProcessPrimitiveValueProps,
  IContentVisitor,
  traverseFieldHierarchy,
  createContentTraverser,
  createFieldHierarchies,
  addFieldHierarchy,
  combineFieldNames,
  parseCombinedFieldNames,
} from "./presentation-common/content/ContentTraverser.js";
/* eslint-disable @typescript-eslint/no-deprecated */
export {
  traverseContent,
  traverseContentItem,
} from "./presentation-common/content/ContentTraverser.js";
/* eslint-enable @typescript-eslint/no-deprecated */
export { createContentFormatter } from "./presentation-common/content/PropertyValueFormatter.js";
export {
  ElementProperties,
  ElementPropertiesCategoryItem,
  ElementPropertiesPrimitivePropertyItem,
  ElementPropertiesPrimitiveArrayPropertyItem,
  ElementPropertiesStructArrayPropertyItem,
  ElementPropertiesArrayPropertyItem,
  ElementPropertiesStructPropertyItem,
  ElementPropertiesPropertyValueType,
  ElementPropertiesPropertyItem,
  ElementPropertiesItem,
} from "./presentation-common/ElementProperties.js";

/**
 * @module Hierarchies
 *
 * @docs-group-description Hierarchies
 * Types related to presentation [hierarchies]($docs/presentation/hierarchies/index.md).
 */
export {
  PresentationQuery,
  IdBinding,
  IdSetBinding,
  ECValueBinding,
  ECValueSetBinding,
  PresentationQueryBinding,
} from "./presentation-common/hierarchy/Key.js";
/* eslint-disable @typescript-eslint/no-deprecated */
export { HierarchyLevel } from "./presentation-common/hierarchy/HierarchyLevel.js";
export {
  StandardNodeTypes,
  NodeKey,
  NodeKeyPath,
  BaseNodeKey,
  ECInstancesNodeKey,
  GroupingNodeKey,
  ECClassGroupingNodeKey,
  ECPropertyGroupingNodeKey,
  LabelGroupingNodeKey,
} from "./presentation-common/hierarchy/Key.js";
export { Node, PartialNode } from "./presentation-common/hierarchy/Node.js";
export { NodePathElement, NodePathFilteringData } from "./presentation-common/hierarchy/NodePathElement.js";
/* eslint-enable @typescript-eslint/no-deprecated */

/**
 * @module PresentationRules
 *
 * @docs-group-description PresentationRules
 * Types for defining the presentation ruleset.
 */
// note: everything under `rules/` is public, so no need to name each exported api
export * from "./presentation-common/rules/hierarchy/ChildNodeRule.js";
export * from "./presentation-common/rules/hierarchy/ChildNodeSpecification.js";
export * from "./presentation-common/rules/hierarchy/CustomNodeSpecification.js";
export * from "./presentation-common/rules/hierarchy/CustomQueryInstanceNodesSpecification.js";
export * from "./presentation-common/rules/hierarchy/InstanceNodesOfSpecificClassesSpecification.js";
export * from "./presentation-common/rules/hierarchy/NavigationRule.js";
export * from "./presentation-common/rules/hierarchy/NodeArtifactsRule.js";
export * from "./presentation-common/rules/hierarchy/RelatedInstanceNodesSpecification.js";
export * from "./presentation-common/rules/hierarchy/RootNodeRule.js";
export * from "./presentation-common/rules/hierarchy/SubCondition.js";
export * from "./presentation-common/rules/customization/CustomizationRule.js";
export * from "./presentation-common/rules/customization/ExtendedDataRule.js";
export * from "./presentation-common/rules/customization/GroupingRule.js";
export * from "./presentation-common/rules/customization/InstanceLabelOverride.js";
export * from "./presentation-common/rules/customization/SortingRule.js";
export * from "./presentation-common/rules/content/ContentInstancesOfSpecificClassesSpecification.js";
export * from "./presentation-common/rules/content/ContentRelatedInstancesSpecification.js";
export * from "./presentation-common/rules/content/ContentRule.js";
export * from "./presentation-common/rules/content/ContentSpecification.js";
export * from "./presentation-common/rules/content/PropertySpecification.js";
export * from "./presentation-common/rules/content/SelectedNodeInstancesSpecification.js";
export * from "./presentation-common/rules/content/DefaultPropertyCategoryOverride.js";
export * from "./presentation-common/rules/content/modifiers/CalculatedPropertiesSpecification.js";
export * from "./presentation-common/rules/content/modifiers/ContentModifier.js";
export * from "./presentation-common/rules/content/modifiers/PropertyCategorySpecification.js";
export * from "./presentation-common/rules/content/modifiers/PropertyEditorsSpecification.js";
export * from "./presentation-common/rules/content/modifiers/CustomRendererSpecification.js";
export * from "./presentation-common/rules/content/modifiers/RelatedPropertiesSpecification.js";
export * from "./presentation-common/rules/ClassSpecifications.js";
export * from "./presentation-common/rules/RelatedInstanceSpecification.js";
export * from "./presentation-common/rules/RelationshipDirection.js";
export * from "./presentation-common/rules/RelationshipPathSpecification.js";
export * from "./presentation-common/rules/Rule.js";
export * from "./presentation-common/rules/Ruleset.js";
export * from "./presentation-common/rules/SchemasSpecification.js";
export * from "./presentation-common/rules/Variables.js";
