/*---------------------------------------------------------------------------------------------
|  $Copyright?: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { PresentationRule } from "./PresentationRule";
import { ContentModifier } from "./content/modifiers/ContentModifier";
import { UserSettingsGroup } from "./UserSettings";

/**
 * Presentation rule set is a list of rules that define tree hierarchy and content provided by
 * RulesDrivenPresentationManager. The rule set consists of:
 * - Ruleset options - defines ruleset parameters.
 * - Navigation rules:
 *   - Root node rules - defines rules for root nodes [[RootNodeRule]].
 *   - Child node rules - defines rules for child nodes [[ChildNodeRule]].
 * - Content rules - defines rules for content [[ContentRule]] you see in content controls.
 * - Customization rules - defines rules for additional customizations [[CustomizationRule]],
 *   such as styling, labeling, checkboxes, etc.
 * - User settings [[UserSettingsGroup]].
 */
export interface PresentationRuleSet {
  /** Rule set identifier. This Id is used to bind content controls with the specific rule set. */
  ruleSetId: string;

  /**
   * List of schema names separated by comma, for which those rules should be applied. Possible values:
   * - Empty - all available schemas will be used.
   * - Explicit - only defined schemas will be used.
   * - Excluded - all available schemas will be used, except defined. To mark the list as exclude list the `E:`
   *   prefix should be used, e.g.: `E:MySchemaName1,MySchemaName2`
   */
  supportedSchemas?: string;

  /**
   * Identifies whether the rule set is supplemental. If this flag is set, this supplemental rule set will be merged
   * with the primary rule set that has the same [[ruleSetId]] and the same [[versionMajor]] value. By default is set to false.
   */
  isSupplemental?: boolean;

  /**
   * If [[isSupplemental]] set to true it is required to set [[supplementalPurpose]].
   * This allows to identify why supplementation is done and uniquely identifies particular supplemental rule set.
   * There can be only one supplemental rule set with the same [[ruleSetId]] and [[supplementalPurpose]].
   * If multiple instances are available, only one will be chosen of the highest [[versionMinor]].
   */
  supplementalPurpose?: string;

  /**
   * Major version of the PresentationRuleSet. This will be used in the future when PresentationRuleSets evolve to
   * identify incompatible changes in the rules between versions. For first release it should **always be 1.**
   *
   * By default is set to 1.
   */
  versionMajor?: number;

  /**
   * Minor version of PresentationRuleSet. This flag can be used to separate rule sets when they evolve.
   * Ruleset with the highest minor version will be chosen if there are multiple instances with the same [[ruleSetId]].
   */
  versionMinor?: number;

  userSettings?: UserSettingsGroup[];
  contentModifiers?: ContentModifier[];
  rules?: PresentationRule[];
}
