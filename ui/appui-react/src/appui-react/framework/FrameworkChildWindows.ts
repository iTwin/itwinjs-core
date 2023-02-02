/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @public */
export interface OpenChildWindowInfo {
  childWindowId: string;
  window: Window;
  parentWindow: Window;
}

/** @public */
export interface ChildWindowLocationProps {
  width: number;
  height: number;
  left: number;
  top: number;
}

/**
 * [[UiFramework.childWindows]] interface.
 * @beta
 */
export interface FrameworkChildWindows {
  /**
   * List of currently open child windows;
   */
  readonly openChildWindows: OpenChildWindowInfo[];

  /**
   * Returns the OpenChildWindowInfo for the related id.
   * @param childWindowId Id of the window to retrieve.
   * @returns undefined if not found.
   */
  find(childWindowId: string | undefined): OpenChildWindowInfo | undefined;

  /**
   * Return the childWindowId of the provided window.
   * @param contentWindow Window element to identify
   * @returns undefined if not found
   */
  findId(contentWindow: Window | undefined | null): string | undefined;

  /** Close all child/pop-out windows. This typically is called when the frontstage is changed. */
  closeAll(): void;

  /**
   * Close a specific child window.
   * @param childWindowId Id of the window to close
   * @param processWindowClose should the `close` method be called on the closing window. (defaults to true)
   * @returns false if the window could not be found.
   */
  close(childWindowId: string, processWindowClose?: boolean): boolean;

  /**
   * Open a new child window.
   * @param childWindowId Id to assign to the newly created window.
   * @param title Title to display on the window.
   * @param content ReactNode to be rendered in the window.
   * @param location Position and size information
   * @param useDefaultPopoutUrl use "/iTwinPopup.html" as the window Url, "" otherwise.
   * @returns true if the window is opened successfully.
   */
  open(childWindowId: string, title: string, content: React.ReactNode, location: ChildWindowLocationProps, useDefaultPopoutUrl?: boolean): boolean;
}
