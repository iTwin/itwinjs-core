/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

export * from "./EC";
export { PresentationError, PresentationStatus } from "./Error";
export { default as KeySet, Keys } from "./KeySet";
export { default as PersistentKeysContainer } from "./PersistentKeysContainer";
export * from "./content/Value";
export * from "./PresentationManagerOptions";
export {
  default as PresentationRpcInterface,
  RpcRequestOptions, ClientStateSyncRequestOptions, ContentRpcRequestOptions,
  HierarchyRpcRequestOptions, SelectionScopeRpcRequestOptions,
  RpcResponse, PresentationRpcResponse,
} from "./PresentationRpcInterface";
export { default as RpcRequestsHandler, IClientStateHolder } from "./RpcRequestsHandler";
export { RulesetVariablesState, VariableValueTypes, VariableValue } from "./RulesetVariables";
export * from "./RegisteredRuleset";
export * from "./RulesetsFactory";
export * from "./Logging";
export * from "./Utils";

/** @module UnifiedSelection */
export * from "./selection/SelectionScope";

/** @module Content */
export { default as CategoryDescription } from "./content/Category";
export { default as Content, ContentJSON } from "./content/Content";
export { default as Descriptor, DescriptorJSON, SelectClassInfo, SelectClassInfoJSON, SelectionInfo, SortDirection, ContentFlags } from "./content/Descriptor";
export { default as DefaultContentDisplayTypes } from "./content/DisplayTypes";
export { default as EditorDescription } from "./content/Editor";
export { BaseFieldJSON, Field, FieldJSON, PropertiesField, PropertiesFieldJSON, NestedContentField, NestedContentFieldJSON } from "./content/Fields";
export { default as Item, ItemJSON } from "./content/Item";
export { default as Property, PropertyJSON } from "./content/Property";
export { PropertyValueFormat, TypeDescription, PrimitiveTypeDescription, ArrayTypeDescription, StructTypeDescription } from "./content/TypeDescription";
export {
  Value, ValuesArray, ValuesMap,
  DisplayValue, DisplayValuesArray, DisplayValuesMap,
  NestedContentValue,
} from "./content/Value";

/** @module Hierarchies */
export {
  NodeKey, NodeKeyPath, NodeKeyJSON, nodeKeyFromJSON, StandardNodeTypes,
  isInstanceNodeKey, isClassGroupingNodeKey, isPropertyGroupingNodeKey,
  isLabelGroupingNodeKey, isGroupingNodeKey,
} from "./hierarchy/Key";
export { BaseNodeKey, ECInstanceNodeKey, ECInstanceNodeKeyJSON, ECClassGroupingNodeKey, ECPropertyGroupingNodeKey, LabelGroupingNodeKey } from "./hierarchy/Key";
export { default as Node, NodeJSON } from "./hierarchy/Node";
export { default as NodePathElement } from "./hierarchy/NodePathElement";

/** @module PresentationRules */
export { RootNodeRule } from "./rules/hierarchy/RootNodeRule";
export { ChildNodeRule } from "./rules/hierarchy/ChildNodeRule";
export { AllInstanceNodesSpecification } from "./rules/hierarchy/AllInstanceNodesSpecification";
export { AllRelatedInstanceNodesSpecification } from "./rules/hierarchy/AllRelatedInstanceNodesSpecification";
export { RelatedInstanceNodesSpecification } from "./rules/hierarchy/RelatedInstanceNodesSpecification";
export { InstanceNodesOfSpecificClassesSpecification } from "./rules/hierarchy/InstanceNodesOfSpecificClassesSpecification";
export {
  CustomQueryInstanceNodesSpecification,
  QuerySpecificationTypes, StringQuerySpecification, ECPropertyValueQuerySpecification,
} from "./rules/hierarchy/CustomQueryInstanceNodesSpecification";
export { CustomNodeSpecification } from "./rules/hierarchy/CustomNodeSpecification";
export { SubCondition } from "./rules/hierarchy/SubCondition";

export { CheckBoxRule } from "./rules/customization/CheckBoxRule";
export { ImageIdOverride } from "./rules/customization/ImageIdOverride";
export { InstanceLabelOverride } from "./rules/customization/InstanceLabelOverride";
export { LabelOverride } from "./rules/customization/LabelOverride";
export { SortingRule } from "./rules/customization/SortingRule";
export { StyleOverride } from "./rules/customization/StyleOverride";
export {
  GroupingRule, GroupingSpecification, GroupingSpecificationTypes,
  SameLabelInstanceGroup, ClassGroup,
  PropertyGroup, PropertyGroupingValue, PropertyRangeGroupSpecification,
} from "./rules/customization/GroupingRule";

export { ContentRule } from "./rules/content/ContentRule";
export { ContentInstancesOfSpecificClassesSpecification } from "./rules/content/ContentInstancesOfSpecificClassesSpecification";
export { ContentRelatedInstancesSpecification } from "./rules/content/ContentRelatedInstancesSpecification";
export { SelectedNodeInstancesSpecification } from "./rules/content/SelectedNodeInstancesSpecification";

export { ContentModifier } from "./rules/content/modifiers/ContentModifier";
export { RelatedPropertiesSpecification, RelationshipMeaning } from "./rules/content/modifiers/RelatedPropertiesSpecification";
export { CalculatedPropertiesSpecification } from "./rules/content/modifiers/CalculatedPropertiesSpecification";
export { PropertiesDisplaySpecification } from "./rules/content/modifiers/PropertiesDisplaySpecification";
export {
  PropertyEditorsSpecification, PropertyEditorParameterTypes,
  PropertyEditorJsonParameters, PropertyEditorMultilineParameters,
  PropertyEditorRangeParameters, PropertyEditorSliderParameters,
} from "./rules/content/modifiers/PropertyEditorsSpecification";

export { Ruleset, SupplementationInfo } from "./rules/Ruleset";
export { Rule, RuleTypes } from "./rules/Rule";
export { RuleSpecificationTypes } from "./rules/RuleSpecification";
export { VariablesGroup, Variable, VariableValueType } from "./rules/Variables";
export { RelatedInstanceSpecification } from "./rules/RelatedInstanceSpecification";
export { RelationshipDirection } from "./rules/RelationshipDirection";
export * from "./rules/ClassSpecifications";
export * from "./rules/SchemasSpecification";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
/* istanbul ignore next */
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("presentation-common", BUILD_SEMVER);
}
