/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

/**
 * Sub-specification to include additional calculated properties into the content.
 *
 * @see [More details]($docs/presentation/Content/CalculatedPropertiesSpecification.md)
 * @public
 */
export interface CalculatedPropertiesSpecification {
  /** Label of the calculated property. May be [localized]($docs/presentation/Advanced/Localization.md). */
  label: string;

  /**
   * [ECExpression]($docs/presentation/Advanced/ECExpressions.md) used to calculate the value. The
   * following symbol sets are available:
   * - [ECInstance ECExpression context]($docs/presentation/Advanced/ECExpressions.md#ecinstance)
   * - [Ruleset variables]($docs/presentation/Advanced/ECExpressions.md#ruleset-variables-user-settings)
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
