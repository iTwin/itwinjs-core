/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module ChildWindowManager
 */

import * as React from "react";
import { ChildWindowLocationProps, OpenChildWindowInfo } from "../framework/FrameworkChildWindows";
import { InternalChildWindowManager } from "./InternalChildWindowManager";

/** Supports opening a child browser window from the main application window. The child window is managed by the main application
 * and is running in the same security context. The application must deliver the html file iTwinPopup.html along side its index.html.
 * See also: [Child Window Manager]($docs/learning/ui/appui-react/ChildWindows.md)
 * @public
 * @deprecated in 3.6. Use `UiFramework.childWindows` property to access.
 * */
export class ChildWindowManager {
  private internal = new InternalChildWindowManager();

  /**
   * Override internal implementation for a mock
   * @internal For tests only.
   */
  public mockInternal(internal: InternalChildWindowManager) {
    this.internal = internal;
  }

  public get openChildWindows() {
    return this.internal.openChildWindows;
  }

  /**
   * @deprecated in 3.6. Use `find` method.
   */
  public findChildWindow(
    childWindowId: string | undefined
  ): OpenChildWindowInfo | undefined {
    return this.internal.find(childWindowId);
  }

  /**
   * @deprecated in 3.6. Use `findId` method.
   */
  public findChildWindowId(
    contentWindow: Window | undefined | null
  ): string | undefined {
    return this.internal.findId(contentWindow);
  }

  /** Close all child/pop-out windows. This typically is called when the frontstage is changed.
   * @deprecated in 3.6. Use `closeAll` method.
   */
  public closeAllChildWindows() {
    return this.internal.closeAll();
  }

  /**
   * @deprecated in 3.6. Use `close` method.
   */
  public closeChildWindow = (
    childWindowId: string,
    processWindowClose = true
  ) => {
    return this.internal.close(childWindowId, processWindowClose);
  };

  /**
   * @deprecated in 3.6. Use `open` method.
   */
  // istanbul ignore next
  public openChildWindow(
    childWindowId: string,
    title: string,
    content: React.ReactNode,
    location: ChildWindowLocationProps,
    useDefaultPopoutUrl?: boolean
  ) {
    return this.internal.open(
      childWindowId,
      title,
      content,
      location,
      useDefaultPopoutUrl
    );
  }

  /**
   * Returns the OpenChildWindowInfo for the related id.
   * @param childWindowId Id of the window to retrieve.
   * @returns undefined if not found.
   */
  public find(childWindowId: string | undefined): OpenChildWindowInfo | undefined {
    return this.internal.find(childWindowId);
  }

  /**
     * Return the childWindowId of the provided window.
     * @param contentWindow Window element to identify
     * @returns undefined if not found
     */
  public findId(contentWindow: Window | undefined | null): string | undefined {
    return this.internal.findId(contentWindow);
  }

  /** Close all child/pop-out windows. This typically is called when the frontstage is changed. */
  public closeAll() {
    return this.internal.closeAll();
  }

  /**
     * Close a specific child window.
     * @param childWindowId Id of the window to close
     * @param processWindowClose should the `close` method be called on the closing window. (defaults to true)
     * @returns false if the window could not be found.
     */
  public close = (childWindowId: string, processWindowClose = true) => {
    return this.internal.close(childWindowId, processWindowClose);
  };

  /**
     * Open a new child window.
     * @param childWindowId Id to assign to the newly created window.
     * @param title Title to display on the window.
     * @param content ReactNode to be rendered in the window.
     * @param location Position and size information
     * @param useDefaultPopoutUrl use "/iTwinPopup.html" as the window Url, "" otherwise.
     * @returns true if the window is opened successfully.
     */
  // istanbul ignore next
  public open(childWindowId: string, title: string, content: React.ReactNode, location: ChildWindowLocationProps, useDefaultPopoutUrl?: boolean) {
    return this.internal.open(childWindowId, title, content, location, useDefaultPopoutUrl);
  }
}

