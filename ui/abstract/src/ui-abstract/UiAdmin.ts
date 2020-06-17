/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiAdmin
 */

import { XAndY } from "@bentley/geometry-core";
import { AbstractMenuItemProps } from "./items/AbstractMenuItemProps";
import { AbstractToolbarProps } from "./items/AbstractToolbarProps";
import { RelativePosition } from "./items/RelativePosition";
import { PropertyDescription } from "./properties/Description";
import { Primitives } from "./properties/PrimitiveTypes";
import { OnCancelFunc, OnItemExecutedFunc, OnNumberCommitFunc, OnValueCommitFunc } from "./utils/callbacks";
import { PropertyRecord } from "./properties/Record";
import { UiDataProvider } from "./dialogs/UiDataProvider";

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

  /** Show an input editor for a primitive value at a particular location.
   * @param _initialValue Value initially displayed in the editor.
   * @param _propertyDescription Description of the primitive value property.
   * @param _location Location of the editor, relative to the origin of htmlElement or the window.
   * @param _onCommit Function called when the OK button or the Enter key is pressed.
   * @param _onCancel Function called when the Cancel button or the Escape key  is pressed.
   * @param _htmlElement The HTMLElement that anchors the context menu. If undefined, the location is relative to the overall window.
   * @return true if the editor was displayed, false if the editor could not be displayed.
   */
  public showInputEditor(_initialValue: Primitives.Value, _propertyDescription: PropertyDescription, _location: XAndY, _onCommit: OnValueCommitFunc, _onCancel: OnCancelFunc, _htmlElement?: HTMLElement): boolean {
    return false;
  }

  /** Hides the input editor. */
  public hideInputEditor(): boolean { return false; }

  /** Show an HTML element at a particular location.
   * @param _displayElement The HTMLElement to display
   * @param _location Location of the tool settings, relative to the origin of anchorElement or the window
   * @param _offset Offset of the display element from the location
   * @param _onCancel Function invoked when the Escape key is pressed or a click occurs outside the display element
   * @param _relativePosition Position relative to the given location. Defaults to TopRight.
   * @param _anchorElement The HTMLElement that anchors the display element. If undefined, the location is relative to the overall window.
   * @return true if the display element was displayed, false if the display element could not be displayed.
   */
  public showHTMLElement(
    _displayElement: HTMLElement, _location: XAndY, _offset: XAndY, _onCancel: OnCancelFunc,
    _relativePosition?: RelativePosition, _anchorElement?: HTMLElement): boolean {
    return false;
  }

  /** Hides the HTML Element. */
  public hideHTMLElement(): boolean { return false; }

  /** Show a Card containing content, a title and a toolbar at a particular location.
   * @param _content The HTMLElement of the content to display
   * @param _title Title to display at the top of the card.
   * @param _toolbarProps Properties of the Toolbar to display.
   * @param _location Location of the Card, relative to the origin of anchorElement or the window.
   * @param _offset Offset of the Card from the location.
   * @param _onItemExecuted Function invoked after a Toolbar item is executed
   * @param _onCancel Function invoked when the Escape key is pressed or a click occurs outside the Card
   * @param _relativePosition Position relative to the given location. Defaults to TopRight.
   * @param _anchorElement The HTMLElement that anchors the Card. If undefined, the location is relative to the overall window.
   * @return true if the Card was displayed, false if the Card could not be displayed.
   */
  public showCard(
    _content: HTMLElement, _title: string | PropertyRecord | undefined, _toolbarProps: AbstractToolbarProps | undefined,
    _location: XAndY, _offset: XAndY, _onItemExecuted: OnItemExecutedFunc, _onCancel: OnCancelFunc,
    _relativePosition?: RelativePosition, _anchorElement?: HTMLElement): boolean {
    return false;
  }

  /** Hides the Card. */
  public hideCard(): boolean { return false; }

  /** Opens a Tool Settings Ui popup at a particular location.
   * @param _dataProvider The UiDataProvider for the tool settings
   * @param _location Location of the tool settings, relative to the origin of anchorElement or the window
   * @param _offset Offset of the tool settings from the location
   * @param _onCancel Function invoked when the Escape key is pressed or a click occurs outside the tool settings
   * @param _relativePosition Position relative to the given location. Defaults to TopRight.
   * @param _anchorElement The HTMLElement that anchors the tool settings. If undefined, the location is relative to the overall window.
   * @return true if the tool settings were displayed, false if the tool settings could not be displayed.
   */
  public openToolSettingsPopup(
    _dataProvider: UiDataProvider, _location: XAndY, _offset: XAndY, _onCancel: OnCancelFunc,
    _relativePosition?: RelativePosition, _anchorElement?: HTMLElement): boolean {
    return false;
  }

  /** Closes the Tool Settings Ui popup. */
  public closeToolSettingsPopup(): boolean { return false; }

}
