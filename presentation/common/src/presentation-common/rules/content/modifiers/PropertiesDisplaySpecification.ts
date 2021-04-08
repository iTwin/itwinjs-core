/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

/**
 * Sub-specification to hide / display specified ECInstance properties.
 * @public
 * @deprecated Use [[PropertySpecification]] instead. Will be removed in iModel.js 3.0
 */
export interface DEPRECATED_PropertiesDisplaySpecification { // eslint-disable-line @typescript-eslint/naming-convention
  /** List of ECProperty names which should be hidden or shown */
  propertyNames: string[];

  /**
   * Controls priority of the specification. Defaults to `1000`.
   *
   * @type integer
   */
  priority?: number;

  /** Should property be displayed. Defaults to `true`. */
  isDisplayed?: boolean;
}
