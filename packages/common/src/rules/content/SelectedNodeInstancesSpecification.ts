/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ContentSpecificationBase } from "./ContentSpecification";
import { PresentationRuleSpecificationTypes } from "../PresentationRuleSpecification";

/**
 * Returns ECInstance(s) of selected node.
 *
 * **Note:**
 * No data is returned for CustomNode.
 */
export interface SelectedNodeInstancesSpecification extends ContentSpecificationBase {
  /** Used for serializing to JSON. */
  type: PresentationRuleSpecificationTypes.SelectedNodeInstancesSpecification;

  /**
   * Allows to filter selected nodes by specified acceptable schema name.
   * All nodes are accepted if this option is not specified.
   */
  acceptableSchemaName?: string;

  /**
   * Allows to filter selected nodes by specified acceptable class name.
   * All nodes are accepted if this option is not specified.
   */
  acceptableClassNames?: string;

  /**
   * Should [[acceptableClassNames]] property be checked polymorphically. If true, all derived classes are accepted as well.
   * By default is set to false.
   *
   * **Note:**
   * Only makes sense when [[acceptableClassNames]] property is specified
   */
  acceptablePolymorphically?: boolean;

  /**
   * Identifies whether we should ignore this specification if there is already existing specification
   * with higher `priority` that already provides content. By default is set to false.
   */
  onlyIfNotHandled?: boolean;
}
