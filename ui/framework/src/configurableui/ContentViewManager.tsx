/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ContentView */

import { UiEvent } from "@bentley/ui-core";

/** MouseDownChanged Event Args class.
 */
export interface MouseDownChangedEventArgs {
  mouseDown: boolean;
}

/** MouseDownChanged Event class.
 */
export class MouseDownChangedEvent extends UiEvent<MouseDownChangedEventArgs> { }

/** ActiveContentChanged Event Args class.
 */
export interface ActiveContentChangedEventArgs {
  oldContent?: React.ReactNode;
  activeContent?: React.ReactNode;
}

/** ActiveContentChanged Event class.
 */
export class ActiveContentChangedEvent extends UiEvent<ActiveContentChangedEventArgs> { }

/** IModel View Manager class.
 */
export class ContentViewManager {
  private static _mouseDown: boolean = false;
  private static _mouseDownChangedEvent: MouseDownChangedEvent = new MouseDownChangedEvent();
  private static _activeContent?: React.ReactNode;
  private static _activeContentChangedEvent: ActiveContentChangedEvent = new ActiveContentChangedEvent();

  public static get MouseDownChangedEvent(): MouseDownChangedEvent { return this._mouseDownChangedEvent; }

  public static isMouseDown(): boolean {
    return this._mouseDown;
  }

  public static setMouseDown(mouseDown: boolean): void {
    this._mouseDown = mouseDown;
    this.MouseDownChangedEvent.emit({ mouseDown });
  }

  public static get ActiveContentChangedEvent(): ActiveContentChangedEvent { return this._activeContentChangedEvent; }

  public static getActiveContent(): React.ReactNode | undefined {
    return this._activeContent;
  }

  public static setActiveContent(activeContent?: React.ReactNode): void {
    if (this._activeContent !== activeContent) {
      const oldContent = activeContent;
      this._activeContent = activeContent;
      this.ActiveContentChangedEvent.emit({ oldContent, activeContent });
    }
  }

}
