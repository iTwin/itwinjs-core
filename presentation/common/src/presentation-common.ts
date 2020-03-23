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
  ClassId, InstanceId, InstanceKey, InstanceKeyJSON,
  ClassInfo, EnumerationChoice, EnumerationInfo, KindOfQuantityInfo,
  PropertyInfo, RelatedClassInfo, RelationshipPath,
} from "./presentation-common/EC";
export { PresentationError, PresentationStatus } from "./presentation-common/Error";
export { KeySet, KeySetJSON, Keys, Key } from "./presentation-common/KeySet";
export { RulesetVariable, VariableValueTypes, VariableValue } from "./presentation-common/RulesetVariables";
export { RegisteredRuleset } from "./presentation-common/RegisteredRuleset";
export { RulesetsFactory } from "./presentation-common/RulesetsFactory";
export { LoggingNamespaces } from "./presentation-common/Logging";
export {
  Omit, Subtract, ValuesDictionary,
  getInstancesCount, DEFAULT_KEYS_BATCH_SIZE,
} from "./presentation-common/Utils";
export { AsyncTasksTracker } from "./presentation-common/AsyncTasks";
export {
  RequestOptions, HierarchyRequestOptions, ContentRequestOptions,
  LabelRequestOptions, SelectionScopeRequestOptions,
  PageOptions, Paged, RequestOptionsWithRuleset, RequestPriority,
} from "./presentation-common/PresentationManagerOptions";
export { LabelDefinition, LabelRawValue, LabelCompositeValue } from "./presentation-common/LabelDefinition";

/**
 * @module RPC
 *
 * @docs-group-description RPC
 * Types used for RPC communication between frontend and backend. Generally should
 * only be used internally by presentation packages.
 */
export {
  PresentationRpcInterface, PresentationRpcRequestOptions,
  LabelRpcRequestOptions, ContentRpcRequestOptions,
  HierarchyRpcRequestOptions, SelectionScopeRpcRequestOptions,
  PresentationRpcResponse,
} from "./presentation-common/PresentationRpcInterface";
export { RpcRequestsHandler, RpcRequestsHandlerProps } from "./presentation-common/RpcRequestsHandler";

/**
 * @module UnifiedSelection
 *
 * @docs-group-description UnifiedSelection
 * Types related to [unified selection]($docs/learning/presentation/Unified-Selection/index.md).
 */
export { SelectionScope } from "./presentation-common/selection/SelectionScope";

/**
 * @module Content
 *
 * @docs-group-description Content
 * Types related to presentation [content]($docs/learning/presentation/Content/index.md).
 */
export { CategoryDescription } from "./presentation-common/content/Category";
export { Content } from "./presentation-common/content/Content";
export {
  Descriptor, DescriptorSource, DescriptorOverrides,
  SelectClassInfo, SelectionInfo, SortDirection, ContentFlags,
} from "./presentation-common/content/Descriptor";
export { DefaultContentDisplayTypes } from "./presentation-common/content/DisplayTypes";
export { EditorDescription } from "./presentation-common/content/Editor";
export { Field, PropertiesField, NestedContentField } from "./presentation-common/content/Fields";
export { Item } from "./presentation-common/content/Item";
export { Property } from "./presentation-common/content/Property";
export {
  PropertyValueFormat, TypeDescription, PrimitiveTypeDescription,
  ArrayTypeDescription, StructTypeDescription, StructFieldMemberDescription,
  BaseTypeDescription,
} from "./presentation-common/content/TypeDescription";
export {
  Value, ValuesArray, ValuesMap,
  DisplayValue, DisplayValuesArray, DisplayValuesMap,
  NestedContentValue,
} from "./presentation-common/content/Value";

/**
 * @module Hierarchies
 *
 * @docs-group-description Hierarchies
 * Types related to presentation [hierarchies]($docs/learning/presentation/Hierarchies/index.md).
 */
export {
  NodeKey, NodeKeyPath, StandardNodeTypes,
  BaseNodeKey, ECInstancesNodeKey, GroupingNodeKey,
  ECClassGroupingNodeKey, ECPropertyGroupingNodeKey, LabelGroupingNodeKey,
  ECInstancesNodeKeyJSON, NodeKeyJSON,
} from "./presentation-common/hierarchy/Key";
export { Node } from "./presentation-common/hierarchy/Node";
export { NodePathElement, NodePathFilteringData } from "./presentation-common/hierarchy/NodePathElement";

/**
 * @module PresentationRules
 *
 * @docs-group-description PresentationRules
 * Types for defining the presentation ruleset.
 */
export * from "./presentation-common/rules/hierarchy/NavigationRule";
export * from "./presentation-common/rules/hierarchy/RootNodeRule";
export * from "./presentation-common/rules/hierarchy/ChildNodeRule";
export * from "./presentation-common/rules/hierarchy/ChildNodeSpecification";
export * from "./presentation-common/rules/hierarchy/AllInstanceNodesSpecification";
export * from "./presentation-common/rules/hierarchy/AllRelatedInstanceNodesSpecification";
export { RelatedInstanceNodesSpecification } from "./presentation-common/rules/hierarchy/RelatedInstanceNodesSpecification";
export * from "./presentation-common/rules/hierarchy/InstanceNodesOfSpecificClassesSpecification";
export * from "./presentation-common/rules/hierarchy/CustomQueryInstanceNodesSpecification";
export * from "./presentation-common/rules/hierarchy/CustomNodeSpecification";
export * from "./presentation-common/rules/hierarchy/SubCondition";
export * from "./presentation-common/rules/hierarchy/NodeArtifactsRule";
export * from "./presentation-common/rules/customization/CustomizationRule";
export * from "./presentation-common/rules/customization/CheckBoxRule";
export * from "./presentation-common/rules/customization/ImageIdOverride";
export * from "./presentation-common/rules/customization/InstanceLabelOverride";
export * from "./presentation-common/rules/customization/LabelOverride";
export * from "./presentation-common/rules/customization/SortingRule";
export * from "./presentation-common/rules/customization/StyleOverride";
export * from "./presentation-common/rules/customization/GroupingRule";
export * from "./presentation-common/rules/customization/ExtendedDataRule";
export * from "./presentation-common/rules/content/ContentRule";
export * from "./presentation-common/rules/content/ContentSpecification";
export * from "./presentation-common/rules/content/ContentInstancesOfSpecificClassesSpecification";
export { ContentRelatedInstancesSpecification } from "./presentation-common/rules/content/ContentRelatedInstancesSpecification";
export * from "./presentation-common/rules/content/SelectedNodeInstancesSpecification";
export * from "./presentation-common/rules/content/PropertySpecification";
export * from "./presentation-common/rules/content/modifiers/ContentModifier";
export {
  RelatedPropertiesSpecification, RelatedPropertiesSpecialValues, RelationshipMeaning,
} from "./presentation-common/rules/content/modifiers/RelatedPropertiesSpecification";
export * from "./presentation-common/rules/content/modifiers/CalculatedPropertiesSpecification";
export * from "./presentation-common/rules/content/modifiers/PropertiesDisplaySpecification";
export * from "./presentation-common/rules/content/modifiers/PropertyEditorsSpecification";
export * from "./presentation-common/rules/Ruleset";
export * from "./presentation-common/rules/Rule";
export * from "./presentation-common/rules/Variables";
export * from "./presentation-common/rules/RelationshipPathSpecification";
export { RelatedInstanceSpecification } from "./presentation-common/rules/RelatedInstanceSpecification";
export * from "./presentation-common/rules/RelationshipDirection";
export * from "./presentation-common/rules/ClassSpecifications";
export * from "./presentation-common/rules/SchemasSpecification";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
/* istanbul ignore next */
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("presentation-common", BUILD_SEMVER);
}
