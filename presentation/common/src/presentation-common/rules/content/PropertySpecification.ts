/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { PropertyEditorSpecification } from "./modifiers/PropertyEditorsSpecification";

/**
 * A container structure for possible property overrides
 * @public
 */
export interface PropertyOverrides {
  /** Priority of the specified overrides */
  overridesPriority?: number;
  /** Label override. May be [localized]($docs/learning/presentation/Localization.md). */
  labelOverride?: string;
  /** ID of a category specified through `PropertyCategorySpecification` in this scope. */
  categoryId?: string;
  /** Display override. `true` to force display, `false` to force hide, `undefined` to use default. */
  isDisplayed?: boolean;
  /** Custom property editor specification */
  editor?: PropertyEditorSpecification;
  /**
   * Flag to control behavior of `isDisplayed` override when it's set to `true`.
   * By default, forcing property display hides all other properties.
   * Setting `doNotHideOtherPropertiesOnDisplayOverride` to `true` disables that behavior and
   * prevents forcing property display of one property from hiding other properties.
   */
  doNotHideOtherPropertiesOnDisplayOverride?: boolean;
}

/**
 * Specification of an ECProperty and its overrides
 * @public
 */
export interface PropertySpecification extends PropertyOverrides {
  /** Name of the ECProperty */
  name: string;
}
