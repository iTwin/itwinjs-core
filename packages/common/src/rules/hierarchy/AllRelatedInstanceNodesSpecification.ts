/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeSpecificationBase } from "./ChildNodeSpecification";
import { PresentationRuleSpecificationTypes } from "../PresentationRuleSpecification";
import { RelationshipDirection } from "../RelationshipDirection";

/**
 * Returns all related instance nodes for parent ECInstance node.
 *
 * **Precondition:**
 * Can be used only if parent node is ECInstance node, if there is
 * no immediate parent instance node it will go up until it finds one.
 */
export interface AllRelatedInstanceNodesSpecification extends ChildNodeSpecificationBase {
  /** Used for serializing to JSON. */
  type: PresentationRuleSpecificationTypes.AllRelatedInstanceNodesSpecification;

  /** Groups instances by ECClass. By default is set to true. */
  groupByClass?: boolean;

  /** Groups instances by display label. By default is set to true. */
  groupByLabel?: boolean;

  /**
   * Skips defined level of related items and shows next level related items.
   *
   * Lets say we have relationship hierarchy A->B->C, but for the user we want to show A->C. In this case we need to
   * set SkipRelatedLevel to 1. The engine will query all direct relationships and all nested relationships and only
   * nested ones will be shown. If there are more than 1 direct relationships it will take them all.
   * By default is set to 0.
   */
  skipRelatedLevel?: number;

  /**
   * List of schemas that should be used while building the query for gathering all related instances. Schema names
   * should be separated by comma (","). In order to define excluded schemas "E:" prefix can be used.
   * By default is set to empty string.
   */
  supportedSchemas?: string;

  /**
   * Direction that will be followed in the relationship select criteria. Possible options: `Forward`, `Backward`, `Both`.
   * By default is set to `Both`.
   */
  requiredDirection?: RelationshipDirection;
}
