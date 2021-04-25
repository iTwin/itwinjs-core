/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module ChildWindow
 */

import "./ChildWindowManager.scss";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { copyStyles } from "./CopyStyles";
import { Provider } from "react-redux";
import { UiFramework } from "../UiFramework";
import { StateManager } from "../redux/StateManager";
import { UiSettingsProvider } from "../uisettings/useUiSettings";
import { PopupRenderer } from "../popup/PopupManager";
import { ModelessDialogRenderer } from "../dialog/ModelessDialogManager";
import { ModalDialogRenderer } from "../dialog/ModalDialogManager";
import { CursorPopupMenu } from "../../ui-framework";

/** @alpha */
export interface OpenChildWindowInfo {
  childWindowId: string;
  window: Window;
  parentWindow: Window;
}

/** @alpha */
export interface ChildWindowLocationProps {
  width: number;
  height: number;
  left: number;
  top: number;
}

/** Supports opening a child browser window from the main application window. The child window is managed by the main application
 * and is running in the same security context. The application must deliver the html file iTwinPopup.html along side its index.html.
 * @alpha */
export class ChildWindowManager {
  private _openChildWindows: OpenChildWindowInfo[] = [];

  public findChildWindow(childWindowId: string | undefined): OpenChildWindowInfo | undefined {
    if (undefined === childWindowId)
      return undefined;

    return this._openChildWindows.find((openWindow) => openWindow.childWindowId === childWindowId);
  }

  public findChildWindowId(contentWindow: Window | undefined | null): string | undefined {
    if (!contentWindow)
      return undefined;

    const childWindow = this._openChildWindows.find((openWindow) => openWindow.window === contentWindow);
    return childWindow?.childWindowId;
  }

  private renderChildWindowContents(childWindow: Window, childWindowId: string, content: React.ReactNode) {
    const reactConnectionDiv = childWindow.document.getElementById("root");
    if (reactConnectionDiv) {
      // set openChildWindows now so components can use it when they mount
      this._openChildWindows.push({
        childWindowId,
        window: childWindow,
        parentWindow: window,
      });

      setTimeout(() => copyStyles(childWindow.document));
      childWindow.document.documentElement.setAttribute("data-theme", UiFramework.getColorTheme());
      setImmediate(() => {
        ReactDOM.render(
          <React.StrictMode>
            <Provider store={StateManager.store} >
              <UiSettingsProvider settingsStorage={UiFramework.getUiSettingsStorage()}>
                <div className="uifw-child-window-container-host">
                  <PopupRenderer />
                  <ModalDialogRenderer />
                  <ModelessDialogRenderer />
                  <CursorPopupMenu />
                  <div className="uifw-child-window-container nz-widget-widget">
                    {content}
                  </div>
                </div>
              </UiSettingsProvider>
            </Provider>
          </React.StrictMode>,
          reactConnectionDiv
        );
      });

      childWindow.onbeforeunload = () => {
        this.closeChildWindow(childWindowId, false);
      };
    }
  }

  public closeChildWindow = (childWindowId: string, processWindowClose = true) => {
    const windowIndex = this._openChildWindows.findIndex((openWindow) => openWindow.childWindowId === childWindowId);
    if (-1 === windowIndex)
      return false;
    const childWindow = this._openChildWindows[windowIndex];
    if (childWindow) {
      this._openChildWindows.splice(windowIndex, 1);
      // AppState.fireWidgetVisibilityChangedEvent();
      if (processWindowClose) {
        childWindow.window.close();
        return true;
      }
    }
    return false;
  };

  public get openChildWindows() {
    return this._openChildWindows;
  }

  private adjustWidowLocation(location: ChildWindowLocationProps, center?: boolean): ChildWindowLocationProps {
    const outLocation = { ...location };

    if (undefined === center && 0 === location.top && 0 === location.left)
      center = true;

    // Prepare position of the new window to be centered against the 'parent' window.
    if (center) {
      outLocation.left =
        window.top.outerWidth / 2 + window.top.screenX - location.width / 2;
      outLocation.top =
        window.top.outerHeight / 2 + window.top.screenY - location.height / 2;
    } else {
      if (undefined !== window.screenLeft && undefined !== window.screenTop) {
        outLocation.top = window.screenTop + location.top;
        outLocation.left = window.screenLeft + location.left;
      }
    }
    return outLocation;
  }

  public openChildWindow(childWindowId: string, title: string, content: React.ReactNode, location: ChildWindowLocationProps) {
    // first check to see if content is already open in child window
    if (this._openChildWindows.findIndex((openWindow) => openWindow.childWindowId === childWindowId) >= 0) {
      return false;
    }

    location = this.adjustWidowLocation(location);

    const childWindow = window.open("/iTwinPopup.html", "", `width=${location.width},height=${location.height},left=${location.left},top=${location.top},menubar=no,resizable=no,scrollbars=no,status=no,location=no`);
    if (!childWindow)
      return false;

    childWindow.addEventListener("load", () => {
      childWindow.document.title = title;
      this.renderChildWindowContents(childWindow, childWindowId, content);
    }, false);

    window.addEventListener("beforeunload", () => {
      this.closeChildWindow(childWindowId);
    }, false);

    return true;
  }
}
