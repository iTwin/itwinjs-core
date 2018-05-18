/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeSpecificationBase } from "./ChildNodeSpecification";
import { PresentationRuleSpecificationTypes } from "../PresentationRuleSpecification";
import { RelationshipDirection } from "../RelationshipDirection";

/**
 * Returns related instance nodes of specified related ECClasses.
 *
 * **Precondition:**
 * Can be used only if parent node is ECInstance node, if there is no immediate parent instance node it will go up until it finds one.
 */
export interface RelatedInstanceNodesSpecification extends ChildNodeSpecificationBase {
  /** Used for serializing to JSON. */
  type: PresentationRuleSpecificationTypes.RelatedInstanceNodesSpecification;

  /** Groups instances by ECClass. By default is set to true. */
  groupByClass?: boolean;

  /** Groups instances by display label. By default is set to true. */
  groupByLabels?: boolean;

  /**
   * Skips defined level of related items and shows next level related items.
   *
   * Lets say we have relationship hierarchy A->B->C, but for the user we want to show A->C. In this case we need to set
   * `skipRelatedLevel` to 1. The engine will query all direct relationships and all nested relationships and
   * only nested ones will be shown. If there are more than 1 direct relationships it will take them all.
   * By default is set to 0.
   */
  skipRelatedLevel?: number;

  /**
   * Condition for filtering instances of defined classes.
   *
   * **See:**
   * [ECExpressions Available in InstanceFilter]($docs/learning/hierarchies/ECExpressions.md#instance-filter)
   */
  instanceFilter?: string;

  /**
   * Direction that will be followed in the relationship select criteria. Possible options: `Forward`, `Backward`, `Both`.
   * By default is set to `Both`.
   */
  requiredDirection?: RelationshipDirection;

  /**
   * Names of ECSchemas used to look up relationships and classes when [[relationshipClassNames]]
   * or [[relatedClassNames]] are not specified.
   */
  supportedSchemas?: string;

  /**
   * Names of ECRelationshipClasses separated by comma.
   * Format: `SchemaName1:ClassName11,ClassName12;SchemaName2:ClassName21,ClassName22`.
   * Optional if [[relatedClassNames]] is specified.
   */
  relationshipClassNames?: string;

  /**
   * Names of related ECClasses separated by comma.
   * Format: `SchemaName1:ClassName11,ClassName12;SchemaName2:ClassName21,ClassName22`.
   * Optional if [[relationshipClassNames]] is specified.
   */
  relatedClassNames?: string;
}
