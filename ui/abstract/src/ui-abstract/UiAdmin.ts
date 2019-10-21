/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Admin */

import { XAndY } from "@bentley/geometry-core";
import { AbstractMenuItemProps } from "./items/AbstractMenuItemProps";
import { AbstractToolbarProps } from "./items/AbstractToolbarProps";
import { RelativePosition } from "./items/RelativePosition";
import { OnCancelFunc, OnItemExecutedFunc } from "./utils/callbacks";

/** The UiAdmin controls various UI components and is callable from IModelApp.uiAdmin in the imodeljs-frontend package.
 * @beta
 */
export class UiAdmin {

  /** @internal */
  public onInitialized() { }

  /** Get the cursor X and Y position. */
  public get cursorPosition(): XAndY { return { x: 0, y: 0 }; }

  /** Create an XAndY object. */
  public createXAndY(x: number, y: number): XAndY { return { x, y }; }

  /** Show a context menu at a particular location.
   * @param _menuItemsProps Properties of the menu items to display.
   * @param _location Location of the context menu, relative to the origin of htmlElement or the window.
   * @param _htmlElement The HTMLElement that anchors the context menu. If undefined, the location is relative to the overall window.
   * @return true if the menu was displayed, false if the menu could not be displayed.
   */
  public showContextMenu(_menuItemsProps: AbstractMenuItemProps[], _location: XAndY, _htmlElement?: HTMLElement): boolean {
    return false;
  }

  /** Show a Toolbar at a particular location.
   * @param _toolbarProps Properties of the Toolbar to display.
   * @param _location Location of the Toolbar, relative to the origin of htmlElement or the window.
   * @param _offset Offset of the Toolbar from the location.
   * @param _onItemExecuted Function invoked after a Toolbar item is executed
   * @param _onCancel Function invoked when the Escape key is pressed or a click occurs outside the Toolbar
   * @param _relativePosition Position relative to the given location. Defaults to TopRight.
   * @param _htmlElement The HTMLElement that anchors the Toolbar. If undefined, the location is relative to the overall window.
   * @return true if the Toolbar was displayed, false if the Toolbar could not be displayed.
   */
  public showToolbar(
    _toolbarProps: AbstractToolbarProps, _location: XAndY, _offset: XAndY, _onItemExecuted: OnItemExecutedFunc, _onCancel: OnCancelFunc,
    _relativePosition?: RelativePosition, _htmlElement?: HTMLElement): boolean {
    return false;
  }

  /** Hides the toolbar. */
  public hideToolbar(): void { }
}
