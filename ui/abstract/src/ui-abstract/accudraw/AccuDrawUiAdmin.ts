/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AccuDraw
 */

import { BeUiEvent } from "@bentley/bentleyjs-core";
import { ColorDef } from "@bentley/imodeljs-common";

/** AccuDraw Settings
 * @alpha
 */
/** X field color, background */
/** Y field color */
/** Z field color */
/** Distance field color, Icon */
/** Angle field color, Icon */

/** X field label */
/** Y field label */
/** Z field label */
/** Distance field label */
/** Angle field label */

/** Field size */
/** Field size adjustment */
/** Animating locks in/out */

/** Size of dialog / widget */
/** Font size */
/** Dialog transparency */
/** Pointer events - none */

/** AccuDraw Commands
 * @alpha
 */
/** Set field color */
/** Set field label */
/** Set dialog transparency */
/** Focus into UI field (based on mouse direction, etc.) */

/** Smart Lock - A, S  */
/** Reposition - A, R (Set AccuDraw Origin) */
/** Toggle mode - A, T  (Rectangular / Polar) */
/** Lock X, Y, Z */
/** Rotate Top, Side, Front - R, T/S/F View, ACS  */

/** Context Menu Behavior
 * @alpha
 */
/** Grays out (disables) current value */
/** Rotate Top, Side, Front - R, T/S/F */
/** Typing active key dismisses menu */
/** Invalid key results in doing nothing (does not dismiss menu) */

/** AccuDraw Dialog Features
 * @alpha
 */
/** Movable */
/** Dockable */

/** AccuDraw UI Field enum
 * @alpha
 */
export enum AccuDrawField {
  X,
  Y,
  Z,
  Distance,
  Angle,
}

/** @alpha */
export interface AccuDrawSetFieldFocusEventArgs {
  field: AccuDrawField;
}

/** @alpha */
export class AccuDrawSetFieldFocusEvent extends BeUiEvent<AccuDrawSetFieldFocusEventArgs> { }

/** @alpha */
export interface AccuDrawSetFieldValueEventArgs {
  field: AccuDrawField;
  value: number;
}

/** @alpha */
export class AccuDrawSetFieldValueEvent extends BeUiEvent<AccuDrawSetFieldValueEventArgs> { }

/** @alpha */
export interface AccuDrawSetFieldLockEventArgs {
  field: AccuDrawField;
  lock: boolean;
}

/** @alpha */
export class AccuDrawSetFieldLockEvent extends BeUiEvent<AccuDrawSetFieldLockEventArgs> { }
