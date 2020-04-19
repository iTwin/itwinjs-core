/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Admin
 */

import { XAndY } from "@bentley/geometry-core";
import {
  UiAdmin, AbstractMenuItemProps, AbstractToolbarProps,
  RelativePosition, OnItemExecutedFunc, OnCancelFunc, OnNumberCommitFunc,
} from "@bentley/ui-abstract";

import { CursorInformation } from "../cursor/CursorInformation";
import { UiFramework } from "../UiFramework";
import { CursorMenuData } from "../redux/SessionState";
import { PopupManager } from "../popup/PopupManager";
import { ConfigurableUiManager } from "../configurableui/ConfigurableUiManager";
import { AccuDrawPopupManager } from "../accudraw/AccuDrawPopupManager";

/** The UiAdmin controls various UI components and is callable from IModelApp.uiAdmin in the imodeljs-frontend package.
 * @beta
 */
export class FrameworkUiAdmin extends UiAdmin {

  /** @internal */
  public onInitialized() { }

  /** Gets the cursor X and Y position. */
  public get cursorPosition(): XAndY { return CursorInformation.cursorPosition; }

  /** Show a context menu at a particular location.
   * @param items Properties of the menu items to display.
   * @param location Location of the context menu, relative to the origin of htmlElement or the overall window.
   * @param htmlElement The HTMLElement that anchors the context menu. If undefined, the location is relative to the overall window.
   * @return true if the menu was displayed, false if the menu could not be displayed.
   */
  public showContextMenu(items: AbstractMenuItemProps[], location: XAndY, htmlElement?: HTMLElement): boolean {
    let position = location;

    if (htmlElement) {
      const anchorOffset = htmlElement.getBoundingClientRect();
      position = { x: anchorOffset.left + location.x, y: anchorOffset.top + location.y };
    }

    const offset = -8;
    position = { x: position.x + offset, y: position.y + offset };

    const cursorMenu: CursorMenuData = { position, items };
    UiFramework.openCursorMenu(cursorMenu);

    return true;
  }

  /** Resolve location and parent element */
  private resolveHtmlElement(location: XAndY, htmlElement?: HTMLElement): { position: XAndY, el: HTMLElement } {
    const position = location;
    let el = htmlElement!;

    if (!htmlElement)
      el = ConfigurableUiManager.getWrapperElement();

    return { position, el };
  }

  /** Show a Toolbar at a particular location.
   * @param toolbarProps Properties of the Toolbar to display.
   * @param location Location of the Toolbar, relative to the origin of htmlElement or the overall window.
   * @param offset Offset of the Toolbar from the location.
   * @param onItemExecuted Function invoked after a Toolbar item is executed
   * @param onCancel Function invoked when the Escape key is pressed or a click occurs outside the Toolbar
   * @param relativePosition Position relative to the given location. Defaults to TopRight.
   * @param htmlElement The HTMLElement that anchors the Toolbar. If undefined, the location is relative to the overall window.
   * @return true if the Toolbar was displayed, false if the Toolbar could not be displayed.
   */
  public showToolbar(toolbarProps: AbstractToolbarProps, location: XAndY, offset: XAndY,
    onItemExecuted: OnItemExecutedFunc, onCancel: OnCancelFunc,
    relativePosition?: RelativePosition, htmlElement?: HTMLElement)
    : boolean {
    const { position, el } = this.resolveHtmlElement(location, htmlElement);

    if (relativePosition === undefined)
      relativePosition = RelativePosition.TopRight;

    return PopupManager.showToolbar(toolbarProps, el, position, offset, onItemExecuted, onCancel, relativePosition);
  }

  /** Hides the toolbar. */
  public hideToolbar(): boolean {
    return PopupManager.hideToolbar();
  }

  /** Show a menu button at a particular location. A menu button opens a context menu.
   * @param id Id of the menu button. Multiple menu buttons may be displayed.
   * @param menuItemsProps Properties of the menu items to display.
   * @param location Location of the context menu, relative to the origin of htmlElement or the window.
   * @param htmlElement The HTMLElement that anchors the context menu. If undefined, the location is relative to the overall window.
   * @return true if the menu was displayed, false if the menu could not be displayed.
   */
  public showMenuButton(id: string, menuItemsProps: AbstractMenuItemProps[], location: XAndY, htmlElement?: HTMLElement): boolean {
    const { position, el } = this.resolveHtmlElement(location, htmlElement);

    return AccuDrawPopupManager.showMenuButton(id, el, position, menuItemsProps);
  }

  /** Hides a menu button.
   * @param id Id of the menu button. Multiple menu buttons may be displayed.
   * @return true if the menu was hidden, false if the menu could not be hidden.
   */
  public hideMenuButton(id: string): boolean {
    return AccuDrawPopupManager.hideMenuButton(id);
  }

  /** Show a calculator at a particular location.
   * @param location Location of the calculator, relative to the origin of htmlElement or the window.
   * @param initialValue Value initially displayed in the calculator.
   * @param resultIcon Icon displayed to the left of the value.
   * @param onOk Function called when the OK button or the Enter key is pressed.
   * @param onCancel Function called when the Cancel button or the Escape key  is pressed.
   * @param htmlElement The HTMLElement that anchors the context menu. If undefined, the location is relative to the overall window.
   * @return true if the menu was displayed, false if the menu could not be displayed.
   */
  public showCalculator(initialValue: number, resultIcon: string, location: XAndY, onOk: OnNumberCommitFunc, onCancel: OnCancelFunc, htmlElement?: HTMLElement): boolean {
    const { position, el } = this.resolveHtmlElement(location, htmlElement);

    return AccuDrawPopupManager.showCalculator(el, position, initialValue, resultIcon, onOk, onCancel);
  }

  /** Hides the calculator. */
  public hideCalculator(): boolean {
    return AccuDrawPopupManager.hideCalculator();
  }

  /** Show an input editor for an angle value at a particular location.
   * @param initialValue Value initially displayed in the editor.
   * @param location Location of the editor, relative to the origin of htmlElement or the window.
   * @param onCommit Function called when the OK button or the Enter key is pressed.
   * @param onCancel Function called when the Cancel button or the Escape key  is pressed.
   * @param htmlElement The HTMLElement that anchors the context menu. If undefined, the location is relative to the overall window.
   * @return true if the editor was displayed, false if the editor could not be displayed.
   */
  public showAngleEditor(initialValue: number, location: XAndY, onCommit: OnNumberCommitFunc, onCancel: OnCancelFunc, htmlElement?: HTMLElement): boolean {
    const { position, el } = this.resolveHtmlElement(location, htmlElement);

    return AccuDrawPopupManager.showAngleEditor(el, position, initialValue, onCommit, onCancel);
  }

  /** Show an input editor for a length value at a particular location.
   * @param initialValue Value initially displayed in the editor.
   * @param location Location of the editor, relative to the origin of htmlElement or the window.
   * @param onCommit Function called when the OK button or the Enter key is pressed.
   * @param onCancel Function called when the Cancel button or the Escape key  is pressed.
   * @param htmlElement The HTMLElement that anchors the context menu. If undefined, the location is relative to the overall window.
   * @return true if the editor was displayed, false if the editor could not be displayed.
   */
  public showLengthEditor(initialValue: number, location: XAndY, onCommit: OnNumberCommitFunc, onCancel: OnCancelFunc, htmlElement?: HTMLElement): boolean {
    const { position, el } = this.resolveHtmlElement(location, htmlElement);

    return AccuDrawPopupManager.showLengthEditor(el, position, initialValue, onCommit, onCancel);
  }

  /** Show an input editor for a height value at a particular location.
   * @param initialValue Value initially displayed in the editor.
   * @param location Location of the editor, relative to the origin of htmlElement or the window.
   * @param onCommit Function called when the OK button or the Enter key is pressed.
   * @param onCancel Function called when the Cancel button or the Escape key  is pressed.
   * @param htmlElement The HTMLElement that anchors the context menu. If undefined, the location is relative to the overall window.
   * @return true if the editor was displayed, false if the editor could not be displayed.
   */
  public showHeightEditor(initialValue: number, location: XAndY, onCommit: OnNumberCommitFunc, onCancel: OnCancelFunc, htmlElement?: HTMLElement): boolean {
    const { position, el } = this.resolveHtmlElement(location, htmlElement);

    return AccuDrawPopupManager.showHeightEditor(el, position, initialValue, onCommit, onCancel);
  }

  /** Hides the input editor. */
  public hideInputEditor(): boolean {
    return PopupManager.hideInputEditor();
  }

  /** Show an HTML element at a particular location.
   * @param displayElement The HTMLElement to display
   * @param location Location of the display element, relative to the origin of htmlElement or the window
   * @param offset Offset of the display element from the location
   * @param onCancel Function invoked when the Escape key is pressed or a click occurs outside the display element
   * @param relativePosition Position relative to the given location. Defaults to TopRight.
   * @param anchorElement The HTMLElement that anchors the display element. If undefined, the location is relative to the overall window.
   * @return true if the display element was displayed, false if the display element could not be displayed.
   */
  public showHTMLElement(
    displayElement: HTMLElement, location: XAndY, offset: XAndY, onCancel: OnCancelFunc,
    relativePosition?: RelativePosition, htmlElement?: HTMLElement): boolean {
    const { position, el } = this.resolveHtmlElement(location, htmlElement);

    if (relativePosition === undefined)
      relativePosition = RelativePosition.TopRight;

    return PopupManager.showHTMLElement(displayElement, el, position, offset, onCancel, relativePosition);
  }

  /** Hides the HTML Element. */
  public hideHTMLElement(): boolean {
    return PopupManager.hideHTMLElement();
  }

}
