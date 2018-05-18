/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeRule } from "./ChildNodeRule";
import { PresentationRuleSpecification } from "../PresentationRuleSpecification";
import { AllInstanceNodesSpecification } from "./AllInstanceNodesSpecification";
import { AllRelatedInstanceNodesSpecification } from "./AllRelatedInstanceNodesSpecification";
import { CustomNodeSpecification } from "./CustomNodeSpecification";
import { InstanceNodesOfSpecificClassesSpecification } from "./InstanceNodesOfSpecificClassesSpecification";
import { RelatedInstanceNodesSpecification } from "./RelatedInstanceNodesSpecification";
import { SearchResultInstanceNodesSpecification } from "./SearchResultInstanceNodesSpecification";
import { RelatedInstanceSpecification } from "../RelatedInstanceSpecification";

/** Base interface for [[ChildNodeSpecification]] */
export interface ChildNodeSpecificationBase extends PresentationRuleSpecification {
  /**
   * This identifies whether specification always returns nodes. Setting this flag to true will improve performance,
   * because it would not require to execute the query in order to check whether the node has any children.
   * By default is set to false.
   */
  alwaysReturnsChildren?: boolean;

  /**
   * This option allows to hide nodes provided by this specification and show nodes of its children directly.
   * This helps if you need to define related instance nodes of particular parent node that is not available in the
   * hierarchy. By default is set to false.
   */
  hideNodesInHierarchy?: boolean;

  /**
   * Hides nodes if they don't have children. Important: this may affect performance significantly.
   * By default is set to false.
   */
  hideIfNoChildren?: boolean;

  /**
   * Set this flag to true to suppress default sorting of ECInstances returned by this specification.
   * The order of persistence provider will be used. By default is set to false.
   */
  doNotSort?: boolean;

  /** [[RelatedInstanceSpecification]] */
  relatedInstances?: RelatedInstanceSpecification[];

  /** [Nested rules]($docs/learning/hierarchies/Terminology.md#nested-rules) */
  nestedRules?: ChildNodeRule[];
}

/**
 * Rule specifications define what content the rule results in.
 * Some of the specifications support filtering which is described in
 * [ECExpressions Available in InstanceFilter]($docs/learning/hierarchies/ECExpressions.md#instance-filter).
 */
export type ChildNodeSpecification = AllInstanceNodesSpecification |
  AllRelatedInstanceNodesSpecification |
  CustomNodeSpecification |
  InstanceNodesOfSpecificClassesSpecification |
  RelatedInstanceNodesSpecification |
  SearchResultInstanceNodesSpecification;
