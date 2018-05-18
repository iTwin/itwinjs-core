/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

/** This is a sub-specification that allows including additional calculated properties into the content.
 *
 * They are defined as child elements to [[ContentSpecification]]
 * or [[ContentModifier]].
 */
export interface CalculatedPropertiesSpecification {
  /** Label of the property. May be [[localized]]. */
  label: string;

  /** Priority of the property. Determines the position of this property in content controls.
   * By default is set to `1000`.
   */
  priority?: number;

  /**
   * ECExpression used to calculate the value. The following symbol sets are available:
   * - [ECInstance ECExpression Context]($docs/learning/ECExpressions.md#ecinstance)
   * - [User Settings Symbols]($docs/learning/ECExpressions.md#user-settings)
   */
  value: string;
}
