/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { PropertyEditorSpecification } from "./modifiers/PropertyEditorsSpecification";
import { PropertyRendererSpecification } from "./modifiers/PropertyRendererSpecification";

/**
 * A container structure for possible property overrides
 * @public
 */
export interface PropertyOverrides {
  /** Priority of the specified overrides. */
  overridesPriority?: number;
  /** Label override. May be [localized]($docs/learning/presentation/Localization.md). */
  labelOverride?: string;
  /** ID of a category specified through `PropertyCategorySpecification` in this scope. */
  categoryId?: string;
  /** Display override. `true` to force display, `false` to force hide, `undefined` to use default. */
  isDisplayed?: boolean;
  /** Custom property renderer specification. */
  renderer?: PropertyRendererSpecification;
  /** Custom property editor specification. */
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
 *
 * @see [More details]($docs/learning/presentation/Content/PropertySpecification.md)
 * @public
 */
export interface PropertySpecification extends PropertyOverrides {
  /**
   * Name of the ECProperty.
   *
   * A `"*"` may be specified to match all properties in current context:
   * - when the specification is used in an ECClass context (e.g. in a [[ContentModifier]] rule),
   *   all properties of that class are matched (including properties derived from base classes, but excluding
   *   subclass properties).
   * - when specification is used outside of class context, all properties found in that context are matched. E.g. when
   *   used in [[ContentSpecification.propertyOverrides]] where [[ContentSpecification]] creates content with properties of
   *   different classes.
   */
  name: string;
}
