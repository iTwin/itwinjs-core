/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

export {
  ClassId, InstanceId, InstanceKey,
  ClassInfo, EnumerationChoice, EnumerationInfo, KindOfQuantityInfo,
  PropertyInfo, RelatedClassInfo, RelationshipPath,
} from "./EC";
export { PresentationError, PresentationStatus } from "./Error";
export { KeySet, Keys, Key } from "./KeySet";
export { PersistentKeysContainer } from "./PersistentKeysContainer";
export {
  RequestOptions, HierarchyRequestOptions, ContentRequestOptions,
  LabelRequestOptions, SelectionScopeRequestOptions,
  PageOptions, Paged, RequestOptionsWithRuleset,
} from "./PresentationManagerOptions";
export {
  PresentationRpcInterface, PresentationRpcRequestOptions,
  LabelRpcRequestOptions, ClientStateSyncRequestOptions, ContentRpcRequestOptions,
  HierarchyRpcRequestOptions, SelectionScopeRpcRequestOptions,
  PresentationRpcResponse,
} from "./PresentationRpcInterface";
export { RpcRequestsHandler, RpcRequestsHandlerProps, IClientStateHolder } from "./RpcRequestsHandler";
export { RulesetVariablesState, VariableValueTypes, VariableValue } from "./RulesetVariables";
export { RegisteredRuleset, RulesetManagerState } from "./RegisteredRuleset";
export { RulesetsFactory } from "./RulesetsFactory";
export { LoggingNamespaces } from "./Logging";
export {
  Omit, Subtract, ValuesDictionary,
  getInstancesCount,
} from "./Utils";
export { AsyncTasksTracker } from "./AsyncTasks";

/** @module UnifiedSelection */
export { SelectionScope } from "./selection/SelectionScope";

/** @module Content */
export { CategoryDescription } from "./content/Category";
export { Content } from "./content/Content";
export {
  Descriptor, DescriptorSource, DescriptorOverrides,
  SelectClassInfo, SelectionInfo, SortDirection, ContentFlags,
} from "./content/Descriptor";
export { DefaultContentDisplayTypes } from "./content/DisplayTypes";
export { EditorDescription } from "./content/Editor";
export { Field, PropertiesField, NestedContentField } from "./content/Fields";
export { Item } from "./content/Item";
export { Property } from "./content/Property";
export {
  PropertyValueFormat, TypeDescription, PrimitiveTypeDescription,
  ArrayTypeDescription, StructTypeDescription, StructFieldMemberDescription,
  BaseTypeDescription,
} from "./content/TypeDescription";
export {
  Value, ValuesArray, ValuesMap,
  DisplayValue, DisplayValuesArray, DisplayValuesMap,
  NestedContentValue,
} from "./content/Value";

/** @module Hierarchies */
export { NodeKey, NodeKeyPath, StandardNodeTypes } from "./hierarchy/Key";
export {
  BaseNodeKey, ECInstanceNodeKey, GroupingNodeKey,
  ECClassGroupingNodeKey, ECPropertyGroupingNodeKey, LabelGroupingNodeKey,
} from "./hierarchy/Key";
export { Node } from "./hierarchy/Node";
export { NodePathElement, NodePathFilteringData } from "./hierarchy/NodePathElement";

/** @module PresentationRules */
export { NavigationRule, NavigationRuleBase } from "./rules/hierarchy/NavigationRule";
export { RootNodeRule } from "./rules/hierarchy/RootNodeRule";
export { ChildNodeRule } from "./rules/hierarchy/ChildNodeRule";
export {
  ChildNodeSpecification, ChildNodeSpecificationTypes,
  ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer,
} from "./rules/hierarchy/ChildNodeSpecification";
export { AllInstanceNodesSpecification } from "./rules/hierarchy/AllInstanceNodesSpecification";
export { AllRelatedInstanceNodesSpecification } from "./rules/hierarchy/AllRelatedInstanceNodesSpecification";
export { RelatedInstanceNodesSpecification } from "./rules/hierarchy/RelatedInstanceNodesSpecification";
export { InstanceNodesOfSpecificClassesSpecification } from "./rules/hierarchy/InstanceNodesOfSpecificClassesSpecification";
export {
  CustomQueryInstanceNodesSpecification, QuerySpecification, QuerySpecificationBase,
  QuerySpecificationTypes, StringQuerySpecification, ECPropertyValueQuerySpecification,
} from "./rules/hierarchy/CustomQueryInstanceNodesSpecification";
export { CustomNodeSpecification } from "./rules/hierarchy/CustomNodeSpecification";
export { SubCondition } from "./rules/hierarchy/SubCondition";

export { CustomizationRule } from "./rules/customization/CustomizationRule";
export { CheckBoxRule } from "./rules/customization/CheckBoxRule";
export { ImageIdOverride } from "./rules/customization/ImageIdOverride";
export {
  InstanceLabelOverride, InstanceLabelOverrideValueSpecificationType, InstanceLabelOverrideValueSpecificationBase,
  InstanceLabelOverrideValueSpecification, InstanceLabelOverridePropertyValueSpecification,
  InstanceLabelOverrideBriefcaseIdSpecification, InstanceLabelOverrideClassLabelSpecification,
  InstanceLabelOverrideClassNameSpecification, InstanceLabelOverrideLocalIdSpecification,
  InstanceLabelOverrideCompositeValueSpecification,
} from "./rules/customization/InstanceLabelOverride";
export { LabelOverride } from "./rules/customization/LabelOverride";
export { SortingRule, PropertySortingRule, DisabledSortingRule, SortingRuleBase } from "./rules/customization/SortingRule";
export { StyleOverride } from "./rules/customization/StyleOverride";
export {
  GroupingRule, GroupingSpecification, GroupingSpecificationTypes,
  SameLabelInstanceGroup, ClassGroup,
  PropertyGroup, PropertyGroupingValue, PropertyRangeGroupSpecification,
  GroupingSpecificationBase,
} from "./rules/customization/GroupingRule";

export { ContentRule } from "./rules/content/ContentRule";
export { ContentSpecification, ContentSpecificationTypes, ContentSpecificationBase } from "./rules/content/ContentSpecification";
export { ContentInstancesOfSpecificClassesSpecification } from "./rules/content/ContentInstancesOfSpecificClassesSpecification";
export { ContentRelatedInstancesSpecification } from "./rules/content/ContentRelatedInstancesSpecification";
export { SelectedNodeInstancesSpecification } from "./rules/content/SelectedNodeInstancesSpecification";

export { ContentModifier } from "./rules/content/modifiers/ContentModifier";
export {
  RelatedPropertiesSpecification, RelationshipMeaning,
  RelatedPropertiesSpecialValues,
} from "./rules/content/modifiers/RelatedPropertiesSpecification";
export { CalculatedPropertiesSpecification } from "./rules/content/modifiers/CalculatedPropertiesSpecification";
export { PropertiesDisplaySpecification } from "./rules/content/modifiers/PropertiesDisplaySpecification";
export {
  PropertyEditorParameters, PropertyEditorParametersBase,
  PropertyEditorsSpecification, PropertyEditorParameterTypes,
  PropertyEditorJsonParameters, PropertyEditorMultilineParameters,
  PropertyEditorRangeParameters, PropertyEditorSliderParameters,
} from "./rules/content/modifiers/PropertyEditorsSpecification";

export { Ruleset, SupplementationInfo } from "./rules/Ruleset";
export { Rule, RuleTypes, RuleBase, ConditionContainer } from "./rules/Rule";
export { VariablesGroup, Variable, VariableValueType } from "./rules/Variables";
export { RelatedInstanceSpecification } from "./rules/RelatedInstanceSpecification";
export { RelationshipDirection } from "./rules/RelationshipDirection";
export { SingleSchemaClassSpecification, MultiSchemaClassesSpecification } from "./rules/ClassSpecifications";
export { SchemasSpecification } from "./rules/SchemasSpecification";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
/* istanbul ignore next */
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("presentation-common", BUILD_SEMVER);
}
