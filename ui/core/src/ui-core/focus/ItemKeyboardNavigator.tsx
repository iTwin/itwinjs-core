/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Focus
 */

import { Orientation } from "../enums/Orientation";

/** Keyboard Navigator for parent components
 * @internal
 */
export class ItemKeyboardNavigator {
  private _direction = new Map<string, number>();
  private _itemCount = 0;
  private _orientation = Orientation.Horizontal;

  constructor(public onFocusItem: (index: number) => void, public onActivateItem: (index: number) => void) {
    this._direction.set("ArrowLeft", -1);
    this._direction.set("ArrowUp", -1);
    this._direction.set("ArrowRight", 1);
    this._direction.set("ArrowDown", 1);
  }

  /** Set the item count */
  public set itemCount(count: number) { this._itemCount = count; }

  /** Set the orientation */
  public set orientation(orientation: Orientation) { this._orientation = orientation; }

  /** Handle keydown on items */
  public handleKeydownEvent(event: React.KeyboardEvent, index: number) {
    const key = event.key;

    switch (key) {
      case "Home":
        event.preventDefault();
        // Activate first item
        this.focusFirstItem();
        break;
      case "End":
        event.preventDefault();
        // Activate last item
        this.focusLastItem();
        break;

      // Up and down are in keydown
      // because we need to prevent page scroll >:)
      case "ArrowUp":
      case "ArrowDown":
        this.determineOrientation(event, index);
        break;
    }
  }

  /** Handle keyup on items */
  public handleKeyupEvent(event: React.KeyboardEvent, index: number) {
    const key = event.key;

    switch (key) {
      case "ArrowLeft":
      case "ArrowRight":
        this.determineOrientation(event, index);
        break;
      case "Enter":
      case " ":
        this.activateItem(index);
        break;
    }
  }

  private focusFirstItem() {
    this.onFocusItem(0);
  }

  private focusLastItem() {
    const index = this._itemCount - 1;
    this.onFocusItem(index);
  }

  /** When an item list's orientation is set to vertical,
   * only up and down arrow should function.
   * In all other cases only left and right arrow function.
   */
  private determineOrientation(event: React.KeyboardEvent, index: number) {
    const key = event.key;
    const vertical = this._orientation === Orientation.Vertical;
    let proceed = false;

    if (vertical) {
      if (key === "ArrowUp" || key === "ArrowDown") {
        event.preventDefault();
        proceed = true;
      }
    } else {
      if (key === "ArrowLeft" || key === "ArrowRight") {
        proceed = true;
      }
    }

    if (proceed) {
      this.switchItemOnArrowPress(event, index);
    }
  }

  /** Either focus the next, previous, first, or last item depending on key pressed
   */
  private switchItemOnArrowPress(event: React.KeyboardEvent, index: number) {
    // Add or subtract depending on key pressed
    const pressed = event.key;
    const targetDirection = this._direction.get(pressed);

    // istanbul ignore else
    if (targetDirection) {
      const newIndex = index + targetDirection;

      if (0 <= newIndex && newIndex < this._itemCount) {
        this.onFocusItem(newIndex);
      } else if (pressed === "ArrowLeft" || pressed === "ArrowUp") {
        this.focusLastItem();
      } else {
        this.focusFirstItem();
      }
    }
  }

  private activateItem(index: number) {
    this.onActivateItem(index);
  }
}
