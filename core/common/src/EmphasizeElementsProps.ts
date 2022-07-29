/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64Array } from "@itwin/core-bentley";
import { ColorDefProps } from "./ColorDef";
import { FeatureAppearanceProps } from "./FeatureSymbology";

/** Options for overriding element appearance.
 * @see [EmphasizeElements]($frontend)
 * @see [[AppearanceOverrideProps]]
 * @public
 * @extensions
 */
export enum FeatureOverrideType {
  /** Override color only. */
  ColorOnly,
  /** Override alpha only. */
  AlphaOnly,
  /** Override both color and alpha. */
  ColorAndAlpha,
}

/** JSON representation of an appearance override in an [[EmphasizeElementsProps]].
 * @see [EmphasizeElements]($frontend).
 * @public
 * @extensions
 */
export interface AppearanceOverrideProps {
  /** Whether to override color, transparency, or both. */
  overrideType?: FeatureOverrideType;
  /** The 0xTTBBGGRR format color/transparency value. */
  color?: ColorDefProps;
  /** The element IDs to display with the specified override. */
  ids?: Id64Array;
}

/** JSON representation of an [EmphasizeElements]($frontend).
 * @public
 * @extensions
 */
export interface EmphasizeElementsProps {
  /** See [EmphasizeElements.getNeverDrawnElements]($frontend) */
  neverDrawn?: Id64Array;
  /** See [EmphasizeElements.getAlwaysDrawnElements]($frontend) */
  alwaysDrawn?: Id64Array;
  /** See [EmphasizeElements.getIsolatedElements]($frontend) */
  isAlwaysDrawnExclusive?: boolean;
  /** See [EmphasizeElements.getEmphasizedIsolatedElements]($frontend) */
  alwaysDrawnExclusiveEmphasized?: Id64Array;
  /** See [EmphasizeElements.defaultAppearance]($frontend) */
  defaultAppearance?: FeatureAppearanceProps;
  /** See [EmphasizeElements.getOverriddenElementsByKey]($frontend) */
  appearanceOverride?: AppearanceOverrideProps[];
  /** See [EmphasizeElements.wantEmphasis]($frontend) */
  wantEmphasis?: boolean;
  /** See [EmphasizeElements.unanimatedAppearance]($frontend) */
  unanimatedAppearance?: FeatureAppearanceProps;
}
