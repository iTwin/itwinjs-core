/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { PropertyEditorSpecification } from "./modifiers/PropertyEditorsSpecification";

/**
 * A container structure for possible property overrides
 * @beta
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
}

/**
 * Specification of an ECProperty and its overrides
 * @beta
 */
export interface PropertySpecification extends PropertyOverrides {
  /** Name of the ECProperty */
  name: string;
}
