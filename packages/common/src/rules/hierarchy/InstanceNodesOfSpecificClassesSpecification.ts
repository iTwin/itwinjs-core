/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeSpecificationBase } from "./ChildNodeSpecification";
import { PresentationRuleSpecificationTypes } from "../PresentationRuleSpecification";

/** Returns all instance nodes of specified ECClasses. */
export interface InstanceNodesOfSpecificClassesSpecification extends ChildNodeSpecificationBase {
  /** Used for serializing to JSON. */
  type: PresentationRuleSpecificationTypes.InstanceNodesOfSpecificClassesSpecification;

  /** Groups instances by ECClass. By default is set to true. */
  groupByClass?: boolean;

  /** Groups instances by display label. By default is set to true. */
  groupByLabel?: boolean;

  /**
   * If this option is set to true, all classes specified by [[classNames]] will be marked as polymorphic in the query.
   * By default is set to false.
   */
  arePolymorphic?: boolean;

  /**
   * Condition for filtering instances of defined classes.
   *
   * **See:**
   * [ECExpressions Available in InstanceFilter]($docs/learning/hierarchies/ECExpressions.md#instance-filter).
   */
  instanceFilter?: string;

  /**
   * Names of ECClasses separated by comma.
   * Format: `SchemaName1:ClassName11,ClassName12;SchemaName2:ClassName21,ClassName22`
   */
  classNames: string;
}
