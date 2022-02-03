/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import type { RuleBase, RuleTypes } from "../Rule";
import type { PropertyCategorySpecification } from "./modifiers/PropertyCategorySpecification";

/**
 * A rule that allows overriding the default property category.
 *
 * The default property category is a category that gets assigned to properties
 * that otherwise have no category.
 *
 * @see [More details]($docs/presentation/Content/DefaultPropertyCategoryOverride.md)
 * @public
 */
export interface DefaultPropertyCategoryOverride extends RuleBase {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.DefaultPropertyCategoryOverride;

  /** Specification of the category override */
  specification: PropertyCategorySpecification;
}
