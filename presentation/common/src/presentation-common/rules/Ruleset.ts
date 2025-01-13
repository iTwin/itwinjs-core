/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { Rule } from "./Rule";
import { RequiredSchemaSpecification } from "./SchemasSpecification";
import { VariablesGroup } from "./Variables";

/**
 * Presentation ruleset is a list of rules that define tree hierarchy and content provided by
 * the presentation library. The ruleset consists of:
 * - Ruleset options
 * - Hierarchy rules:
 *   - Root node rules
 *   - Child node rules
 * - Content rules for content you see in content controls like property grid and table.
 * - Customization rules used for additional customizations such as styling, labeling, checkboxes, etc.
 * - User-controllable variables.
 *
 * @see [Presentation library documentation page]($docs/presentation/index.md)
 * @public
 */
export interface Ruleset {
  /**
   * Ruleset identifier. This ID is used to bind UI components with the specific rule set.
   *
   * @minLength 1
   */
  id: string;

  /**
   * Version of the presentation ruleset in SemVer format: `{major}.{minor}.{patch}`.
   *
   * Setting the version is optional, but might be useful when ruleset is persisted
   * somewhere and evolves over time. Having a version helps choose persisting
   * strategy (keep all versions or only latest) and find the latest ruleset from a list
   * of rulesets with the same id.
   *
   * Defaults to `0.0.0`.
   *
   * @pattern ^[\d]+\.[\d]+\.[\d]+$
   */
  version?: string;

  /**
   * Schema requirements for this ruleset. The ruleset is not used if the requirements are not met.
   */
  requiredSchemas?: RequiredSchemaSpecification[];

  /** Supplementation-related information for this ruleset */
  supplementationInfo?: SupplementationInfo;

  /** User-controllable variable definitions */
  vars?: VariablesGroup[];

  /** Presentation rules used to create hierarchies and content */
  rules: Rule[];
}

/**
 * Contains supplementation-related information for
 * [supplemental rulesets]($docs/presentation/advanced/RulesetSupplementation.md).
 *
 * @public
 */
export interface SupplementationInfo {
  /**
   * Identifies why supplementation is done and uniquely identifies particular supplemental ruleset.
   * There can be only one supplemental rule set with the same [[Ruleset.id]] and [[supplementationPurpose]].
   */
  supplementationPurpose: string;
}
