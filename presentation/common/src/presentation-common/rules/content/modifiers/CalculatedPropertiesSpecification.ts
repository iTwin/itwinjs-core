/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

/**
 * This content modifier allows including additional calculated properties into the content.
 *
 * @see [Calculated properties specification reference documentation page]($docs/presentation/content/CalculatedPropertiesSpecification.md)
 * @public
 */
export interface CalculatedPropertiesSpecification {
  /** Specifies label of the calculated property. Supports [localization]($docs/presentation/advanced/Localization.md). */
  label: string;

  /**
   * Defines an expression to calculate the value. The expression can use [ECInstance]($docs/presentation/advanced/ECExpressions.md#ecinstance)
   * and [Ruleset Variables]($docs/presentation/advanced/ECExpressions.md#ruleset-variables-user-settings) symbol contexts.
   */
  value: string;

  /**
   * Assign a custom [[Field.priority]] to the property. It's up to the UI component to make sure that priority
   * is respected - properties with higher priority should appear before or above properties with lower priority.
   *
   * @type integer
   */
  priority?: number;
}
