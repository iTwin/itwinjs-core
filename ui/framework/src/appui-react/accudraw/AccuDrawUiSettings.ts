/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AccuDraw
 */

import { ColorDef } from "@itwin/core-common";
import { IconSpec } from "@itwin/core-react";

/** AccuDraw User Interface Settings
 * @beta
 */
export interface AccuDrawUiSettings {
  /** X field style */
  xStyle?: React.CSSProperties;
  /** Y field style */
  yStyle?: React.CSSProperties;
  /** Z field style */
  zStyle?: React.CSSProperties;
  /** Angle field style */
  angleStyle?: React.CSSProperties;
  /** Distance field style */
  distanceStyle?: React.CSSProperties;

  /** X field background color */
  xBackgroundColor?: ColorDef | string;
  /** Y field background color */
  yBackgroundColor?: ColorDef | string;
  /** Z field background color */
  zBackgroundColor?: ColorDef | string;
  /** Angle field background color */
  angleBackgroundColor?: ColorDef | string;
  /** Distance field background color */
  distanceBackgroundColor?: ColorDef | string;

  /** X field foreground color */
  xForegroundColor?: ColorDef | string;
  /** Y field foreground color */
  yForegroundColor?: ColorDef | string;
  /** Z field foreground color */
  zForegroundColor?: ColorDef | string;
  /** Angle field foreground color */
  angleForegroundColor?: ColorDef | string;
  /** Distance field foreground color */
  distanceForegroundColor?: ColorDef | string;

  /** X field label */
  xLabel?: string;
  /** Y field label */
  yLabel?: string;
  /** Z field label */
  zLabel?: string;
  /** Angle field label */
  angleLabel?: string;
  /** Distance field label */
  distanceLabel?: string;

  /** X field icon */
  xIcon?: IconSpec;
  /** Y field icon */
  yIcon?: IconSpec;
  /** Z field icon */
  zIcon?: IconSpec;
  /** Angle field icon */
  angleIcon?: IconSpec;
  /** Distance field icon */
  distanceIcon?: IconSpec;
}
