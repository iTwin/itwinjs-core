/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Admin
 */

import { XAndY } from "@bentley/geometry-core";
import { AbstractMenuItemProps } from "./items/AbstractMenuItemProps";
import { AbstractToolbarProps } from "./items/AbstractToolbarProps";
import { RelativePosition } from "./items/RelativePosition";
import { OnCancelFunc, OnItemExecutedFunc, OnNumberCommitFunc } from "./utils/callbacks";

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
  public hideToolbar(): boolean { return false; }

  /** Show a menu button at a particular location. A menu button opens a context menu.
   * @param _id Id of the menu button. Multiple menu buttons may be displayed.
   * @param _menuItemsProps Properties of the menu items to display.
   * @param _location Location of the context menu, relative to the origin of htmlElement or the window.
   * @param _htmlElement The HTMLElement that anchors the context menu. If undefined, the location is relative to the overall window.
   * @return true if the button was displayed, false if the button could not be displayed.
   */
  public showMenuButton(_id: string, _menuItemsProps: AbstractMenuItemProps[], _location: XAndY, _htmlElement?: HTMLElement): boolean {
    return false;
  }

  /** Hides a menu button.
   * @param _id Id of the menu button. Multiple menu buttons may be displayed.
   * @return true if the menu was hidden, false if the menu could not be hidden.
   */
  public hideMenuButton(_id: string): boolean { return false; }

  /** Show a calculator at a particular location.
   * @param _initialValue Value initially displayed in the calculator.
   * @param _resultIcon Icon displayed to the left of the value.
   * @param _location Location of the calculator, relative to the origin of htmlElement or the window.
   * @param _onCommit Function called when the OK button or the Enter key is pressed.
   * @param _onCancel Function called when the Cancel button or the Escape key  is pressed.
   * @param _htmlElement The HTMLElement that anchors the context menu. If undefined, the location is relative to the overall window.
   * @return true if the calculator was displayed, false if the calculator could not be displayed.
   */
  public showCalculator(_initialValue: number, _resultIcon: string, _location: XAndY, _onCommit: OnNumberCommitFunc, _onCancel: OnCancelFunc, _htmlElement?: HTMLElement): boolean {
    return false;
  }

  /** Hides the calculator. */
  public hideCalculator(): boolean { return false; }

  /** Show an input editor for an angle value at a particular location.
   * @param _initialValue Value initially displayed in the editor.
   * @param _location Location of the editor, relative to the origin of htmlElement or the window.
   * @param _onCommit Function called when the OK button or the Enter key is pressed.
   * @param _onCancel Function called when the Cancel button or the Escape key  is pressed.
   * @param _htmlElement The HTMLElement that anchors the context menu. If undefined, the location is relative to the overall window.
   * @return true if the editor was displayed, false if the editor could not be displayed.
   */
  public showAngleEditor(_initialValue: number, _location: XAndY, _onCommit: OnNumberCommitFunc, _onCancel: OnCancelFunc, _htmlElement?: HTMLElement): boolean {
    return false;
  }

  /** Show an input editor for a length value at a particular location.
   * @param _initialValue Value initially displayed in the editor.
   * @param _location Location of the editor, relative to the origin of htmlElement or the window.
   * @param _onCommit Function called when the OK button or the Enter key is pressed.
   * @param _onCancel Function called when the Cancel button or the Escape key  is pressed.
   * @param _htmlElement The HTMLElement that anchors the context menu. If undefined, the location is relative to the overall window.
   * @return true if the editor was displayed, false if the editor could not be displayed.
   */
  public showLengthEditor(_initialValue: number, _location: XAndY, _onCommit: OnNumberCommitFunc, _onCancel: OnCancelFunc, _htmlElement?: HTMLElement): boolean {
    return false;
  }

  /** Show an input editor for a height value at a particular location.
   * @param _initialValue Value initially displayed in the editor.
   * @param _location Location of the editor, relative to the origin of htmlElement or the window.
   * @param _onCommit Function called when the OK button or the Enter key is pressed.
   * @param _onCancel Function called when the Cancel button or the Escape key  is pressed.
   * @param _htmlElement The HTMLElement that anchors the context menu. If undefined, the location is relative to the overall window.
   * @return true if the editor was displayed, false if the editor could not be displayed.
   */
  public showHeightEditor(_initialValue: number, _location: XAndY, _onCommit: OnNumberCommitFunc, _onCancel: OnCancelFunc, _htmlElement?: HTMLElement): boolean {
    return false;
  }

  /** Hides the input editor. */
  public hideInputEditor(): boolean { return false; }

}
