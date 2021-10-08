/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { RelativePosition } from "@itwin/appui-abstract";
import { Popup, WebFontIcon } from "@itwin/core-react";
import { MapLayersUiItemsProvider } from "../MapLayersUiItemsProvider";
import { MapManagerSettings } from "./MapManagerSettings";

import "./MapLayerSettingsPopupButton.scss";

/** @alpha */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapLayerSettingsPopupButton() {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [buttonTooltip] = React.useState(MapLayersUiItemsProvider.localization.getLocalizedString("mapLayers:Widget.SettingsButtonTooltip"));

  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const togglePopupDisplay = React.useCallback((event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();
    setIsSettingsOpen((prev) => !prev);
  }, [setIsSettingsOpen]);

  const handleCloseSetting = React.useCallback(() => {
    setIsSettingsOpen(false);
  }, [setIsSettingsOpen]);

  return (
    <>
      <button title={buttonTooltip} className="maplayers-settings-popup-button" onClick={togglePopupDisplay} ref={buttonRef}>
        <WebFontIcon iconName="icon-settings" />
      </button>
      <Popup
        isOpen={isSettingsOpen}
        position={RelativePosition.BottomRight}
        onClose={handleCloseSetting}
        target={buttonRef.current}
      >
        <div className="maplayers-settings-popup-panel">
          <MapManagerSettings />
        </div>
      </Popup >
    </ >
  );
}
