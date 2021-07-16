/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import useInterval from "./useInterval";

// Hook that will show a popup window
export function useEsriOAuth2Popup(visible: boolean, url: string|undefined, title: string, onClose: () => void) {

  const [checkPopupAliveDelay, setCheckPopupAliveDelay] = React.useState<number|undefined>();

  // ONLY re-render the popup when visibility changes, any other changes get differed until next visibility change
  // hence the massive use of 'useRef'
  const popupWindow = React.useRef<Window>();
  const savedUrl = React.useRef(url);
  const savedTitle = React.useRef(title);
  const savedOnClose = React.useRef(onClose);
  React.useEffect(() => {savedOnClose.current = onClose;}, [onClose]);
  React.useEffect(() => {savedUrl.current = url;}, [url]);
  React.useEffect(() => {savedTitle.current = title;}, [title]);

  // Cleanup method after a popup closure.  Also calls the OnClose callback.
  const handleClosedPopup = React.useCallback(() => {
    if (popupWindow.current?.closed ) {
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
      if (popupWindow.current !== undefined ) {
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
      /*
      const oauthState = encodeURIComponent(savedContextUrl.current);
      const arcgisUrl = `https://www.arcgis.com/sharing/rest/oauth2/authorize?client_id=${EsriOAuth2.arcGisOnlineClientId}&response_type=token&expiration=${EsriOAuth2.expiration}&redirect_uri=${EsriOAuth2.redirectUri}&state=${oauthState}`;
      const popup = window.open(arcgisUrl, "ArcGIS login", "directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no,scrollbars=no,resizable=no,width=450,height=450");
     */
      const popup = window.open(savedUrl.current, savedTitle.current, "directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no,scrollbars=no,resizable=no,width=450,height=450");
      if (popup) {
        popup.focus();
        popupWindow.current = popup;

        // Start and interval that will check if popup got closed by user
        setCheckPopupAliveDelay(1000);
      }
    }

    // If not visible but a previous popup window is still open, close it.
    if (!visible && popupWindow.current !== undefined ) {
      popupWindow.current.close();
      /*
      popupWindow.current = undefined;
      setCheckPopupAliveDelay(undefined);
      savedOnClose.current();
      */
      handleClosedPopup();
    }

  },  [handleClosedPopup, visible]);
}

export default useEsriOAuth2Popup;
