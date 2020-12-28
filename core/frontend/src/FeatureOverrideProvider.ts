/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Viewport } from "./Viewport";
import { FeatureSymbology } from "./render/FeatureSymbology";

/** An object that customizes the appearance of Features within a [[Viewport]].
 * Only one FeatureOverrideProvider may be associated with a viewport at a time. Setting a new FeatureOverrideProvider replaces any existing provider.
 *
 * If the provider's internal state changes such that the Viewport should recompute the symbology overrides, the provider should notify the viewport by
 * calling [[Viewport.setFeatureOverrideProviderChanged]].
 * @see [[Viewport.addFeatureOverrideProvider]]
 * @see [[Viewport.dropFeatureOverrideProvider]]
 * @public
 */
export interface FeatureOverrideProvider {
  /** Add to the supplied `overrides` any symbology overrides to be applied to the specified `viewport`. */
  addFeatureOverrides(overrides: FeatureSymbology.Overrides, viewport: Viewport): void;
}
