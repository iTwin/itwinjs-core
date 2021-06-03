/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64Array } from "@bentley/bentleyjs-core";
import { ColorDefProps } from "./ColorDef";
import { FeatureAppearanceProps } from "./FeatureSymbology";

/** Options for overriding element appearance.
 * @see [EmphasizeElements]($frontend)
 * @see [[AppearanceOverrideProps]]
 * @public
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
 */
export interface AppearanceOverrideProps {
  overrideType?: FeatureOverrideType;
  color?: ColorDefProps;
  ids?: Id64Array;
}

/** JSON representation of an [EmphasizeElements]($frontend).
 * @public
 */
export interface EmphasizeElementsProps {
  neverDrawn?: Id64Array;
  alwaysDrawn?: Id64Array;
  isAlwaysDrawnExclusive?: boolean;
  alwaysDrawnExclusiveEmphasized?: Id64Array;
  defaultAppearance?: FeatureAppearanceProps;
  appearanceOverride?: AppearanceOverrideProps[];
  wantEmphasis?: boolean;
  unanimatedAppearance?: FeatureAppearanceProps;
}
