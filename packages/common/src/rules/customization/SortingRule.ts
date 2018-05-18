/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ConditionalCustomizationRuleBase } from "./CustomizationRule";
import { PresentationRuleTypes } from "../PresentationRule";

/** SortingRule is a rule that allows to configure sorting for certain ECInstance nodes in the hierarchy and/or content.
 * It is possible to configure different sorting for different types of ECInstances.
 * Multiple sorting rules may be applied for the same instances - in this case the instances are first sorted by the
 * highest priority rule and then the lower priority ones.
 *
 * **Note:**
 * This rule is not meant to be used to sort grouping nodes, custom nodes or other non ECInstance type of nodes.
 * Class nodes or class grouping nodes sorting can be customized, though, by setting ClassPriority CustomAttribute on ECClasses.
 */
export interface SortingRule extends ConditionalCustomizationRuleBase {
  /** Used for serializing to JSON. */
  type: PresentationRuleTypes.SortingRule;

  /** Schema name of the ECInstance that needs to be sorted using this rule options.
   * If it is not specified rule will be applied to all ECInstances.
   */
  schemaName?: string;

  /** Class name of the ECInstance that needs to be sorted using this rule options.
   * If it is not specified rule will be applied to all ECInstances.
   */
  className?: string;

  /* Property name that should be used for sorting */
  propertyName?: string;

  /** Will sort in ascending order if set to true, otherwise descending. Default is set to true. */
  sortAscending?: boolean;

  /** If this option is set, then it will not use any sorting and items will be listed as PersistenceProvider returns
   * them. By default is set to false.
   */
  doNotSort?: boolean;

  /** Identifies whether ECClass defined in this rule should be accepted polymorphically. By default is set to false. */
  isPolymorphic?: boolean;
}
