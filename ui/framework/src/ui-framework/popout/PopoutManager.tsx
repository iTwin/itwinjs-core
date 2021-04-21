/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// Cspell: ignore Popout

/** @packageDocumentation
 * @module Popout
 */

import "./PopoutManager.scss";
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
export interface OpenPopoutWindow {
  contentId: string;
  window: Window;
  parentWindow: Window;
}

/** @alpha */
export interface PopoutWindowLocationProps {
  width: number;
  height: number;
  left: number;
  top: number;
}

/** Support opening a popout from the main application window.
 * @alpha */
export class PopoutManager {
  private _openPopoutWindows: OpenPopoutWindow[] = [];

  public findPopoutWindow(contentId: string | undefined): OpenPopoutWindow | undefined {
    if (undefined === contentId)
      return undefined;

    return this._openPopoutWindows.find((openWindow) => openWindow.contentId === contentId);
  }

  public findPopoutWindowId(contentWindow: Window | undefined): string | undefined {
    if (undefined === contentWindow)
      return undefined;

    const popoutWindow = this._openPopoutWindows.find((openWindow) => openWindow.window === contentWindow);
    return popoutWindow?.contentId;
  }

  private renderPopOut(popoutWindow: Window, contentId: string, content: React.ReactNode) {
    const reactConnectionDiv = popoutWindow.document.getElementById("root");
    if (reactConnectionDiv) {
      // set openPopoutWindows now so components can use it when they mount
      this._openPopoutWindows.push({
        contentId,
        window: popoutWindow,
        parentWindow: window,
      });

      setTimeout(() => copyStyles(popoutWindow.document));
      popoutWindow.document.documentElement.setAttribute("data-theme", UiFramework.getColorTheme());
      setImmediate(() => {
        ReactDOM.render(
          <React.StrictMode>
            <Provider store={StateManager.store} >
              <UiSettingsProvider settingsStorage={UiFramework.getUiSettingsStorage()}>
                <div className="uifw-popout-container-host">
                  <PopupRenderer />
                  <ModalDialogRenderer />
                  <ModelessDialogRenderer />
                  <CursorPopupMenu />
                  <div className="uifw-popout-container nz-widget-widget">
                    {content}
                  </div>
                </div>
              </UiSettingsProvider>
            </Provider>
          </React.StrictMode>,
          reactConnectionDiv
        );
      });

      popoutWindow.onbeforeunload = () => {
        this.closePopout(contentId, false);
      };
    }
  }

  public closePopout = (contentId: string, processWindowClose = true) => {
    const windowIndex = this._openPopoutWindows.findIndex((openWindow) => openWindow.contentId === contentId);
    if (-1 === windowIndex)
      return false;
    const popout = this._openPopoutWindows[windowIndex];
    if (popout) {
      this._openPopoutWindows.splice(windowIndex, 1);
      // AppState.fireWidgetVisibilityChangedEvent();
      if (processWindowClose) {
        popout.window.close();
        return true;
      }
    }
    return false;
  };

  public get openPopoutWindows() {
    return this._openPopoutWindows;
  }

  private adjustWidowLocation(location: PopoutWindowLocationProps, center?: boolean): PopoutWindowLocationProps {
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

  public openPopout(contentId: string, title: string, content: React.ReactNode, location: PopoutWindowLocationProps) {
    // first check to see if content is already open in popout window
    if (this._openPopoutWindows.findIndex((openWindow) => openWindow.contentId === contentId) >= 0) {
      return false;
    }

    location = this.adjustWidowLocation(location);

    const popoutWindow = window.open("/iTwinPopout.html", "", `width=${location.width},height=${location.height},left=${location.left},top=${location.top},menubar=no,resizable=no,scrollbars=no,status=no,location=no`);
    if (!popoutWindow)
      return false;

    popoutWindow.addEventListener("load", () => {
      popoutWindow.document.title = title;
      this.renderPopOut(popoutWindow, contentId, content);
    }, false);

    window.addEventListener("beforeunload", () => {
      this.closePopout(contentId);
    }, false);

    return true;
  }
}
