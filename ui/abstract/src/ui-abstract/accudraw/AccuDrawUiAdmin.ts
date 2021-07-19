/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiAdmin
 */

import { BeUiEvent } from "@bentley/bentleyjs-core";

/** AccuDraw UI Field enum
 * @alpha
 */
export enum AccuDrawField {
  Distance,
  Angle,
  X,
  Y,
  Z,
}

/** AccuDraw Mode
 * @alpha
 */
export enum AccuDrawMode {
  Polar,
  Rectangular,
}

/** @alpha */
export interface AccuDrawSetFieldFocusEventArgs {
  field: AccuDrawField;
}

/** @alpha */
export class AccuDrawSetFieldFocusEvent extends BeUiEvent<AccuDrawSetFieldFocusEventArgs> { }

/** @alpha */
export interface AccuDrawSetFieldValueToUiEventArgs {
  field: AccuDrawField;
  value: number;
  formattedValue: string;
}

/** @alpha */
export class AccuDrawSetFieldValueToUiEvent extends BeUiEvent<AccuDrawSetFieldValueToUiEventArgs> { }

/** @alpha */
export interface AccuDrawSetFieldValueFromUiEventArgs {
  field: AccuDrawField;
  stringValue: string;
}

/** @alpha */
export class AccuDrawSetFieldValueFromUiEvent extends BeUiEvent<AccuDrawSetFieldValueFromUiEventArgs> { }

/** @alpha */
export interface AccuDrawSetFieldLockEventArgs {
  field: AccuDrawField;
  lock: boolean;
}

/** @alpha */
export class AccuDrawSetFieldLockEvent extends BeUiEvent<AccuDrawSetFieldLockEventArgs> { }

/** @alpha */
export interface AccuDrawSetModeEventArgs {
  mode: AccuDrawMode;
}

/** @alpha */
export class AccuDrawSetModeEvent extends BeUiEvent<AccuDrawSetModeEventArgs> { }

/** @alpha */
export class AccuDrawGrabInputFocusEvent extends BeUiEvent<{}> { }

/** @alpha */
export class AccuDrawUiAdmin {
  /** AccuDraw Set Field Focus event. */
  public static readonly onAccuDrawSetFieldFocusEvent = new AccuDrawSetFieldFocusEvent();

  /** AccuDraw Set Field Value to Ui event. */
  public static readonly onAccuDrawSetFieldValueToUiEvent = new AccuDrawSetFieldValueToUiEvent();

  /** AccuDraw Set Field Value from Ui event. */
  public static readonly onAccuDrawSetFieldValueFromUiEvent = new AccuDrawSetFieldValueFromUiEvent();

  /** AccuDraw Set Field Lock event. */
  public static readonly onAccuDrawSetFieldLockEvent = new AccuDrawSetFieldLockEvent();

  /** AccuDraw Set Mode event. */
  public static readonly onAccuDrawSetModeEvent = new AccuDrawSetModeEvent();

  /** AccuDraw Grab Input Focus event. */
  public static readonly onAccuDrawGrabInputFocusEvent = new AccuDrawGrabInputFocusEvent();

  /** AccuDraw Set Field Value to Ui. */
  public setFieldValueToUi(field: AccuDrawField, value: number, formattedValue: string): void {
    AccuDrawUiAdmin.onAccuDrawSetFieldValueToUiEvent.emit({ field, value, formattedValue });
  }

  /** AccuDraw Set Field Value from Ui. */
  public setFieldValueFromUi(field: AccuDrawField, stringValue: string): void {
    AccuDrawUiAdmin.onAccuDrawSetFieldValueFromUiEvent.emit({ field, stringValue });
  }

  /** AccuDraw Set Field Focus. */
  public setFieldFocus(field: AccuDrawField): void {
    AccuDrawUiAdmin.onAccuDrawSetFieldFocusEvent.emit({ field });
  }

  /** AccuDraw Set Field Lock. */
  public setFieldLock(field: AccuDrawField, lock: boolean): void {
    AccuDrawUiAdmin.onAccuDrawSetFieldLockEvent.emit({ field, lock });
  }

  /** Set AccuDraw Compass Mode. */
  public setMode(mode: AccuDrawMode): void {
    AccuDrawUiAdmin.onAccuDrawSetModeEvent.emit({ mode });
  }

  /** Determine if AccuDraw UI has focus */
  public get hasInputFocus() { return false; }

  /** Set focus to the AccuDraw UI. */
  public grabInputFocus() {
    AccuDrawUiAdmin.onAccuDrawGrabInputFocusEvent.emit({});
  }

}
