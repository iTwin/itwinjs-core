/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { RuleBase } from "../Rule";
import { PropertyCategorySpecification } from "./modifiers/PropertyCategorySpecification";

/**
 * A rule that allows overriding the default property category.
 *
 * The default property category is a category that gets assigned to properties that otherwise have no category.
 *
 * @see [Default property category override reference documentation page]($docs/presentation/content/DefaultPropertyCategoryOverride.md)
 * @public
 */
export interface DefaultPropertyCategoryOverride extends RuleBase {
  /** Used for serializing to JSON. */
  ruleType: "DefaultPropertyCategoryOverride";

  /** Specification for the custom property category. */
  specification: PropertyCategorySpecification;
}
