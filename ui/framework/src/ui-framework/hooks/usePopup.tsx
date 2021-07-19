/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Hooks
 */

import * as React from "react";
import useInterval from "./useInterval";

/** Hook that will show a popup window
 * @beta
 */
export function usePopup(visible: boolean, url: string | undefined, title: string, width: number, height: number, onClose: () => void) {

  const [checkPopupAliveDelay, setCheckPopupAliveDelay] = React.useState<number | undefined>();

  // ONLY re-render the popup when visibility changes, any other changes get differed until next visibility change
  // hence the massive use of 'useRef'
  const popupWindow = React.useRef<Window>();
  const savedUrl = React.useRef(url);
  const savedTitle = React.useRef(title);
  const savedWidth = React.useRef(width);
  const savedHeight = React.useRef(height);
  const savedOnClose = React.useRef(onClose);

  React.useEffect(() => { savedUrl.current = url; }, [url]);
  React.useEffect(() => { savedTitle.current = title; }, [title]);
  React.useEffect(() => { savedWidth.current = width; }, [width]);
  React.useEffect(() => { savedHeight.current = height; }, [height]);
  React.useEffect(() => { savedOnClose.current = onClose; }, [onClose]);

  // Cleanup method after a popup closure.  Also calls the OnClose callback.
  const handleClosedPopup = React.useCallback(() => {
    if (popupWindow.current?.closed) {
      savedOnClose.current();
      setCheckPopupAliveDelay(undefined);
      popupWindow.current = undefined;
    }
  }, []);

  // Whenever the hook is unloaded, make sure the underlying popup get closed.
  // Note: An interval is used to check if popup was closed by user: because we access
  // a cross domain resource inside the popup, we don't have access to popup window events.
  // As a workaround, we periodically check if popup is still alive.
  // Reference: https://stackoverflow.com/questions/9388380/capture-the-close-event-of-popup-window-in-javascript/48240128#48240128
  React.useEffect(() => {
    return () => {
      if (popupWindow.current !== undefined) {
        popupWindow.current.close();
        handleClosedPopup();
      }
    };
  }, [handleClosedPopup]);

  // Timer that checks if popup was closed by end-user
  useInterval(handleClosedPopup, checkPopupAliveDelay);

  // ==> Main render effect
  // Monitors visibility changes and open/close the popup accordingly.
  React.useEffect(() => {
    // If visible and a popup window is not already open, open a new popup window
    if (visible && popupWindow.current === undefined) {
      const popup = window.open(savedUrl.current, savedTitle.current, `width=${savedWidth.current},height=${savedHeight.current}`);
      if (popup) {
        popup.focus();
        popupWindow.current = popup;

        // Start and interval that will check if popup got closed by user
        setCheckPopupAliveDelay(1000);
      }
    }

    // If not visible but a previous popup window is still open, close it.
    if (!visible && popupWindow.current !== undefined) {
      popupWindow.current.close();
      handleClosedPopup();
    }

  }, [handleClosedPopup, visible]);
}

export default usePopup;
