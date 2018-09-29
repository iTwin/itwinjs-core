/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

/** Base class for [[ContentSpecificationBase]] and [[ChildNodeSpecificationBase]] */
export interface RuleSpecification {
  /** Used for serializing to JSON. */
  specType: RuleSpecificationTypes;

  /**
   * Defines the order in which presentation rules will be evaluated and executed. Defaults to `1000`.
   *
   * @type integer
   */
  priority?: number;
}

/** Used for serializing array of [[ContentSpecification]] and [[ChildNodeSpecification]] */
export const enum RuleSpecificationTypes {
  // hierarchy specifications
  AllInstanceNodes = "AllInstanceNodes",
  AllRelatedInstanceNodes = "AllRelatedInstanceNodes",
  RelatedInstanceNodes = "RelatedInstanceNodes",
  InstanceNodesOfSpecificClasses = "InstanceNodesOfSpecificClasses",
  CustomQueryInstanceNodes = "CustomQueryInstanceNodes",
  CustomNode = "CustomNode",

  // content specifications
  ContentInstancesOfSpecificClasses = "ContentInstancesOfSpecificClasses",
  ContentRelatedInstances = "ContentRelatedInstances",
  SelectedNodeInstances = "SelectedNodeInstances",
}
