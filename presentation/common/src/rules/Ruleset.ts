/*---------------------------------------------------------------------------------------------
|  $Copyright?: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { Rule } from "./Rule";
import { VariablesGroup } from "./Variables";
import { SchemasSpecification } from "./SchemasSpecification";

/**
 * Presentation ruleset is a list of rules that define tree hierarchy and content provided by
 * the presentation manager. The ruleset consists of:
 * - Ruleset options
 * - Navigation rules:
 *   - Root node rules
 *   - Child node rules
 * - Content rules for content you see in content controls
 * - Customization rules used for additional customizations such as styling, labeling, checkboxes, etc.
 * - User-controllable variables.
 */
export interface Ruleset {
  /**
   * Ruleset identifier. This ID is used to bind UI components with the specific rule set.
   *
   * @minLength 1
   */
  id: string;

  /**
   * Names of schemas which the rules should be applied for. Rules are applied to all
   * schemas if this property is not set.
   */
  supportedSchemas?: SchemasSpecification;

  /** Supplementation-related information for this ruleset */
  supplementationInfo?: SupplementationInfo;

  /** User-controllable variable definitions */
  vars?: VariablesGroup[];

  /** Presentation rules used to create hierarchies and content */
  rules: Rule[];
}

/**
 * Contains supplementation-related information for
 * [supplemental rulesets]($docs/learning/RulesetSupplementation.md).
 */
export interface SupplementationInfo {
  /**
   * Identifies why supplementation is done and uniquely identifies particular supplemental ruleset.
   * There can be only one supplemental rule set with the same [[Ruleset.id]] and [[supplementationPurpose]].
   */
  supplementationPurpose: string;
}
