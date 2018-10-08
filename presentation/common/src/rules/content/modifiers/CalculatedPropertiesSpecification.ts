/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

/**
 * Sub-specification to include additional calculated properties into the content.
 */
export interface CalculatedPropertiesSpecification {
  /** Label of the calculated property. May be [localized]($docs/learning/Localization.md). */
  label: string;

  /**
   * [ECExpression]($docs/learning/ECExpressions.md) used to calculate the value. The
   * following symbol sets are available:
   * - [ECInstance ECExpression context]($docs/learning/ECExpressions.md#ecinstance)
   * - [Ruleset variables]($docs/learning/ECExpressions.md#ruleset-variables-user-settings)
   */
  value: string;

  /**
   * Priority of the property. Determines the position of this property in UI
   * components - higher priority means the property should be more visible.
   * Defaults to `1000`.
   *
   * @type integer
   */
  priority?: number;
}
