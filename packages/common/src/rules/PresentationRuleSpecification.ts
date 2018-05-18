/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

/** Base class for [[ContentSpecificationBase]] and [[ChildNodeSpecificationBase]] */
export interface PresentationRuleSpecification {
  /** Defines the order in which presentation rules will be evaluated and executed. By default is set to 1000. */
  priority?: number;
}

/** Used for serializing array of [[ContentSpecification]] and [[ChildNodeSpecification]] */
export enum PresentationRuleSpecificationTypes {
  AllInstanceNodesSpecification = "AllInstanceNodes",
  AllRelatedInstanceNodesSpecification = "AllRelatedInstanceNodes",
  ContentInstancesOfSpecificClassesSpecification = "ContentInstancesOfSpecificClasses",
  ContentRelatedInstancesSpecification = "ContentRelatedInstances",
  CustomNodeSpecification = "CustomNode",
  InstanceNodesOfSpecificClassesSpecification = "InstanceNodesOfSpecificClasses",
  RelatedInstanceNodesSpecification = "RelatedInstanceNodes",
  SearchResultInstanceNodesSpecification = "SearchResultInstanceNodes",
  SelectedNodeInstancesSpecification = "SelectedNodeInstances",
}
