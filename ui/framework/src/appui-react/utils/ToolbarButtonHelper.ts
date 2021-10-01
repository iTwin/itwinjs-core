
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

/** A set of Dom helper methods
 * @public
 */
export class ToolbarButtonHelper {

  public static searchToolbarsByTitle(title: string, horizontal: boolean): HTMLButtonElement | null {
    // first look for simple tool buttons
    const nodeList = document.documentElement.querySelectorAll(`div.nz-toolbar-items.nz-${horizontal ? "horizontal" : "vertical"}.nz-items .nz-toolbar-item-item`);
    // istanbul ignore else
    if (nodeList && nodeList.length > 0) {
      for (const node of nodeList) {
        const button = node as HTMLButtonElement;
        if (button.title === title) {
          return button;
        }
      }
    }

    return null;
  }

  /** Search Horizontal Toolbars for button by title. */
  public static searchHorizontalToolbarsByTitle(title: string): HTMLButtonElement | null {
    return ToolbarButtonHelper.searchToolbarsByTitle(title, true);
  }

  /** Search Vertical Toolbars by Title for button by title. */
  public static searchVerticalToolbarsByTitle(title: string): HTMLButtonElement | null {
    return ToolbarButtonHelper.searchToolbarsByTitle(title, false);
  }

  /** Get toolbar button by title. */
  public static getToolbarButtonByTitle(title: string): HTMLButtonElement | null {
    let button = ToolbarButtonHelper.searchHorizontalToolbarsByTitle(title);
    // istanbul ignore if
    if (button)
      return button;

    button = ToolbarButtonHelper.searchVerticalToolbarsByTitle(title);
    // istanbul ignore else
    if (button)
      return button;

    // istanbul ignore next
    return null;
  }

  /** Get App button. */
  public static getAppButton(): HTMLButtonElement | null {
    const node = document.documentElement.querySelector("div.nz-app-button > button");
    // istanbul ignore else
    if (node)
      return node as HTMLButtonElement;
    // istanbul ignore next
    return null;
  }
}
