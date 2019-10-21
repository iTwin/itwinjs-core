/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Admin */

import { XAndY } from "@bentley/geometry-core";
import {
  UiAdmin, AbstractMenuItemProps, AbstractToolbarProps,
  RelativePosition, OnItemExecutedFunc, OnCancelFunc,
} from "@bentley/ui-abstract";

import { CursorInformation } from "../cursor/CursorInformation";
import { UiFramework } from "../UiFramework";
import { CursorMenuData } from "../SessionState";
import { PopupManager } from "../popup/PopupManager";

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
  public showToolbar(toolbarProps: AbstractToolbarProps, location: XAndY, offset: XAndY, onItemExecuted: OnItemExecutedFunc, onCancel: OnCancelFunc, relativePosition?: RelativePosition, htmlElement?: HTMLElement): boolean {
    let position = location;

    if (htmlElement) {
      const anchorOffset = htmlElement.getBoundingClientRect();
      position = { x: anchorOffset.left + location.x, y: anchorOffset.top + location.y };
    } else {
      const wrapper = document.getElementById("uifw-configurableui-wrapper");
      htmlElement = wrapper!;
    }

    if (relativePosition === undefined)
      relativePosition = RelativePosition.TopRight;

    PopupManager.showToolbar(toolbarProps, htmlElement, position, offset, onItemExecuted, onCancel, relativePosition);

    return true;
  }

  /** Hides the toolbar. */
  public hideToolbar(): void {
    PopupManager.removeToolbar();
  }

}
