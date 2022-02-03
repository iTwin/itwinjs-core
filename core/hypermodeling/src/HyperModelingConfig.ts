/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HyperModeling
 */

import type { SectionType } from "@itwin/core-common";
import type { SectionMarkerHandler } from "./SectionMarkerHandler";

/** Configures display of [[SectionMarker]]s for [[HyperModelingDecorator]]s.
 * @see [[HyperModelingDecorator.updateConfiguration]] or [[HyperModelingDecorator.replaceConfiguration]] to change the configuration for a specific decorator.
 * @see [[HyperModeling.initialize]] to set the default configuration for all decorators at package initialization.
 * @see [[HyperModeling.updateConfiguration]] or [[HyperModeling.replaceConfiguration]] to change the default configuration for all subsequently created decorators.
 * @see [[HyperModelingConfig]].
 * @public
 */
export interface SectionMarkerConfig {
  /** Whether to hide markers belonging to models that are not present in the view's [ModelSelector]($backend). If true, markers are displayed regardless of their models. */
  readonly ignoreModelSelector?: boolean;
  /** Whether to hide markers belonging to categories that are not present in the view's [CategorySelector]($backend). If true, markers are displayed regardless of their categories. */
  readonly ignoreCategorySelector?: boolean;
  /** A list of types of section markers that shouold not be displayed. By default, markers for all section types are displayed. */
  readonly hiddenSectionTypes?: SectionType[];
}

/** Configures how 2d graphics are displayed by a [[HyperModelingDecorator]] when hypermodeling is active.
 * This configuration is used primarily for debugging, and applies globally to section graphics associated with all [[HyperModelingDecorator]]s.
 * @see [[HyperModeling.initialize]] to set this configuration at package initialization.
 * @see [[HyperModeling.updateConfiguration]] or [[HyperModeling.replaceConfiguration]] to change this configuration after package initialization.
 * @see [[HyperModelingConfig]].
 * @public
 */
export interface SectionGraphicsConfig {
  /** If true, 2d graphics will not be clipped. */
  readonly ignoreClip?: boolean;
  /** If true, clip volumes for 2d graphics are displayed as shapes. */
  readonly debugClipVolumes?: boolean;
  /** If true, [SectionDrawing]($backend) graphics will not be displayed.
   * @see [[hideSheetAnnotations]]
   */
  readonly hideSectionGraphics?: boolean;
  /** If true, [Sheet]($backend) annotation graphics will not be displayed.
   * @see [[hideSectionGraphics]]
   */
  readonly hideSheetAnnotations?: boolean;
}

/** Configuration options for the hyper-modeling package.
 * @see [[HyperModeling.initialize]] to set the configuration at package initialization.
 * @see [[HyperModeling.updateConfiguration]] or [[HyperModeling.replaceConfiguration]] to modify the configuration after package initialization.
 * @public
 */
export interface HyperModelingConfig {
  /** Specifies how the user interacts with [[SectionMarker]]s. If omitted, the default interactions will be used. */
  readonly markerHandler?: SectionMarkerHandler;
  /** Default [[SectionMarker]] display configuration used when creating a new [[HyperModelingDecorator]]. */
  readonly markers?: SectionMarkerConfig;
  /** Global section graphics configuration used by all [[HyperModelingDecorator]]s when displaying drawings and sheets in a spatial view. Primarily for debugging. */
  readonly graphics?: SectionGraphicsConfig;
}
