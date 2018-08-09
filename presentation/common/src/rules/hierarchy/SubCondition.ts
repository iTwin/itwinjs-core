/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeSpecification } from "./ChildNodeSpecification";
import { ConditionContainer } from "../Rule";

/**
 * Defines child node specifications which should only be handled when a condition
 * is satisfied.
 */
export interface SubCondition extends ConditionContainer {
  /** Nested sub-conditions */
  subConditions?: SubCondition[];

  /** Child node specifications which are used if condition is satisfied */
  specifications?: ChildNodeSpecification[];
}
