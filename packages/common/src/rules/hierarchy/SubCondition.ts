/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeSpecification } from "./ChildNodeSpecification";

/**
 * Defines child node specifications which should only be handled when a condition
 * is satisfied.
 */
export interface SubCondition {
  /** The condition that has to be satisfied for child node specifications to be handled */
  condition?: string;

  /** Nested sub-conditions */
  subConditions?: SubCondition[];

  /** Child node specifications which will be used if condition is satisfied */
  specifications?: ChildNodeSpecification[];
}
