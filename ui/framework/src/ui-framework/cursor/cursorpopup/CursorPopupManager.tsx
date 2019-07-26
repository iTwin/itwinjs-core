/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Cursor */

import { UiEvent } from "@bentley/ui-core";
import { RelativePosition } from "@bentley/imodeljs-frontend";
import { Point } from "@bentley/ui-ninezone";

/** Properties for the [[CursorPopup]] open method
 * @alpha
 */
export interface CursorPopupProps {
  /** Title of the popup */
  title?: string;
  /** Called on popup close */
  onClose?: () => void;
  /** Callback to apply changes */
  onApply?: () => void;
  /** Draw shadow */
  shadow?: boolean;
}

/** CursorPopup Open Event Args interface.
 * @internal
 */
export interface CursorPopupOpenEventArgs {
  id: string;
  content: React.ReactNode;
  pt: Point;
  offset: number;
  relativePosition: RelativePosition;
  props?: CursorPopupProps;
}

/** CursorPopup Open Event class.
 * @internal
 */
export class CursorPopupOpenEvent extends UiEvent<CursorPopupOpenEventArgs> { }

/** CursorPopup Update Position Event Args interface.
 * @internal
 */
export interface CursorPopupUpdatePositionEventArgs {
  pt: Point;
  offset: number;
  relativePosition: RelativePosition;
}

/** CursorPopup Update Position Event class.
 * @internal
 */
export class CursorPopupUpdatePositionEvent extends UiEvent<CursorPopupUpdatePositionEventArgs> { }

/** CursorPopup Close Event Args interface.
 * @internal
 */
export interface CursorPopupCloseEventArgs {
  id: string;
  apply: boolean;
  fadeOut?: boolean;
}

/** CursorPopup Close Event class.
 * @internal
 */
export class CursorPopupCloseEvent extends UiEvent<CursorPopupCloseEventArgs> { }

/** CursorPopup component
 * @alpha
 */
export class CursorPopupManager {

  /** @internal */
  public static readonly onCursorPopupOpenEvent = new CursorPopupOpenEvent();
  /** @internal */
  public static readonly onCursorPopupUpdatePositionEvent = new CursorPopupUpdatePositionEvent();
  /** @internal */
  public static readonly onCursorPopupCloseEvent = new CursorPopupCloseEvent();

  /** Called to open popup with a new set of properties
   */
  public static open(id: string, content: React.ReactNode, pt: Point, offset: number, relativePosition: RelativePosition, props?: CursorPopupProps) {
    CursorPopupManager.onCursorPopupOpenEvent.emit({ id, content, pt, offset, relativePosition, props });
  }

  /** Called to update popup with a new set of properties
   */
  public static update(id: string, content: React.ReactNode, pt: Point, offset: number, relativePosition: RelativePosition) {
    CursorPopupManager.onCursorPopupOpenEvent.emit({ id, content, pt, offset, relativePosition });
  }

  /** Called to move the open popup to new location
   */
  public static updatePosition(pt: Point, offset: number, relativePosition: RelativePosition) {
    CursorPopupManager.onCursorPopupUpdatePositionEvent.emit({ pt, offset, relativePosition });
  }

  /** Called when tool wants to close the popup
   */
  public static close(id: string, apply: boolean, fadeOut?: boolean) {
    CursorPopupManager.onCursorPopupCloseEvent.emit({ id, apply, fadeOut });
  }
}
