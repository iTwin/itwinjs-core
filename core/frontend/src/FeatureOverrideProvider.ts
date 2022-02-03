/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import type { Viewport } from "./Viewport";
import type { FeatureSymbology } from "./render/FeatureSymbology";

/** An object that customizes the appearance of [Feature]($common)s within a [[Viewport]] using [[FeatureSymbology.Overrides]].
 * When the viewport needs to recreate the symbology overrides, it invokes the provider's [[addFeatureOverrides]] method.
 * If necessary - for example, because of changes to some state from which the provider derives the overrides - the provider
 * can request that the viewport recreate the overrides by calling [[Viewport.setFeatureOverrideProviderChanged]].
 *
 * @see [[Viewport.addFeatureOverrideProvider]] to register a provider with a viewport.
 * @public
 */
export interface FeatureOverrideProvider {
  /** Add to the supplied overrides any symbology overrides to be applied to the specified viewport. */
  addFeatureOverrides(overrides: FeatureSymbology.Overrides, viewport: Viewport): void;
}
