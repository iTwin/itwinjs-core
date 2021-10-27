/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Focus
 */

import { isArrowKey, SpecialKey } from "@itwin/appui-abstract";
import { Orientation } from "../enums/Orientation";

/** Cross-Axis Arrow Key Callback
 * @internal
 */
export type CrossAxisArrowKeyFunc = (forward: boolean) => void;

/** Keyboard Navigator for parent components
 * @internal
 */
export class ItemKeyboardNavigator {
  private _direction: Map<string, number>;
  private _itemCount = 0;
  private _orientation = Orientation.Horizontal;
  private _allowWrap = true;
  private _crossAxisArrowKeyHandler?: CrossAxisArrowKeyFunc;

  constructor(public onFocusItem: (index: number) => void, public onActivateItem: (index: number) => void) {
    this._direction = new Map<string, number>([
      [SpecialKey.ArrowLeft, -1],
      [SpecialKey.ArrowUp, -1],
      [SpecialKey.ArrowRight, 1],
      [SpecialKey.ArrowDown, 1],
    ]);
  }

  /** The item count */
  public get itemCount(): number { return this._itemCount; }
  public set itemCount(count: number) { this._itemCount = count; }

  /** The primary orientation */
  public get orientation(): Orientation { return this._orientation; }
  public set orientation(orientation: Orientation) { this._orientation = orientation; }

  /** The allow wrap property controls whether the movement will stop at the first and last items or wrap  */
  public get allowWrap(): boolean { return this._allowWrap; }
  public set allowWrap(v: boolean) { this._allowWrap = v; }

  /** Called when the arrow keys that run perpendicular to the primary orientation are pressed */
  public get crossAxisArrowKeyHandler(): CrossAxisArrowKeyFunc | undefined { return this._crossAxisArrowKeyHandler; }
  public set crossAxisArrowKeyHandler(v: CrossAxisArrowKeyFunc | undefined) { this._crossAxisArrowKeyHandler = v; }

  /** Handle KeyDown on items */
  public handleKeyDownEvent(event: React.KeyboardEvent, index: number): void {
    const key = event.key;

    switch (key) {
      case SpecialKey.Home:
        event.preventDefault();
        // Activate first item
        this.focusFirstItem();
        break;
      case SpecialKey.End:
        event.preventDefault();
        // Activate last item
        this.focusLastItem();
        break;

      // Up and down are in keydown
      // because we need to prevent page scroll >:)
      case SpecialKey.ArrowUp:
      case SpecialKey.ArrowDown:
        this.determineOrientation(event, index);
        break;

      case SpecialKey.Enter:
      case SpecialKey.Space:
        this.activateItem(index);
        break;
    }
  }

  /** Handle KeyUp on items */
  public handleKeyUpEvent(event: React.KeyboardEvent, index: number): void {
    const key = event.key;

    switch (key) {
      case SpecialKey.ArrowLeft:
      case SpecialKey.ArrowRight:
        this.determineOrientation(event, index);
        break;
    }
  }

  private focusFirstItem(): void {
    this.onFocusItem(0);
  }

  private focusLastItem(): void {
    const index = this._itemCount - 1;
    this.onFocusItem(index);
  }

  /** When an item list's orientation is set to vertical,
   * only up and down arrow should function.
   * In all other cases only left and right arrow function.
   */
  private determineOrientation(event: React.KeyboardEvent, index: number): void {
    const key = event.key;
    const vertical = this._orientation === Orientation.Vertical;
    let proceed = false;

    if (vertical) {
      if (key === SpecialKey.ArrowUp || key === SpecialKey.ArrowDown) {
        event.preventDefault();
        proceed = true;
      } else if (this.crossAxisArrowKeyHandler && (key === SpecialKey.ArrowLeft || key === SpecialKey.ArrowRight)) {
        this.crossAxisArrowKeyHandler(key === SpecialKey.ArrowRight);
      }
    } else {
      if (key === SpecialKey.ArrowLeft || key === SpecialKey.ArrowRight) {
        proceed = true;
      } else if (this.crossAxisArrowKeyHandler && (key === SpecialKey.ArrowUp || key === SpecialKey.ArrowDown)) {
        this.crossAxisArrowKeyHandler(key === SpecialKey.ArrowDown);
      }
    }

    if (proceed) {
      this.switchItemOnArrowPress(event, index);
    }
  }

  /** Either focus the next, previous, first, or last item depending on key pressed
   */
  private switchItemOnArrowPress(event: React.KeyboardEvent, index: number): void {
    // Add or subtract depending on key pressed
    const pressed = event.key;
    const targetDirection = this._direction.get(pressed);

    // istanbul ignore else
    if (targetDirection) {
      const newIndex = index + targetDirection;

      if (0 <= newIndex && newIndex < this._itemCount) {
        this.onFocusItem(newIndex);
      } else {
        // istanbul ignore else
        if (this._allowWrap) {
          if (pressed === SpecialKey.ArrowLeft || pressed === SpecialKey.ArrowUp) {
            this.focusLastItem();
          } else {
            this.focusFirstItem();
          }
        }
      }
    }
  }

  private activateItem(index: number): void {
    this.onActivateItem(index);
  }
}

/** Determines if a KeyboardEvent.key is an Item Navigation key
 * @internal
 */
export function isNavigationKey(key: string): boolean {
  return (isArrowKey(key) || key === SpecialKey.Home || key === SpecialKey.End || key === SpecialKey.Space || key === SpecialKey.Enter);
}
