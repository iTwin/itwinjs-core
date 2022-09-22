/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { RelativePosition } from "@itwin/appui-abstract";
import { Popup, WebFontIcon } from "@itwin/core-react";
import { MapManagerSettings } from "./MapManagerSettings";

import "./MapLayerSettingsPopupButton.scss";
import { MapLayersUI } from "../../mapLayers";
import { Button } from "@itwin/itwinui-react";
export interface MapLayerSettingsPopupButtonProps {
  disabled?: boolean;
}

/** @alpha */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapLayerSettingsPopupButton(props: MapLayerSettingsPopupButtonProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [buttonTooltip] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:Widget.SettingsButtonTooltip"));

  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const togglePopupDisplay = React.useCallback((event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();
    setIsSettingsOpen((prev) => !prev);
  }, [setIsSettingsOpen]);

  const handleCloseSetting = React.useCallback(() => {
    setIsSettingsOpen(false);
  }, [setIsSettingsOpen]);

  const isInsideCoreDialog = React.useCallback((element: HTMLElement) => {
    if (element.nodeName === "DIV") {
      if (element.classList && element.classList.contains("core-dialog"))
        return true;
      if (element.parentElement && isInsideCoreDialog(element.parentElement))
        return true;
    } else {
      // istanbul ignore else
      if (element.parentElement && isInsideCoreDialog(element.parentElement))
        return true;
    }
    return false;
  }, []);

  const handleOutsideClick = React.useCallback((event: MouseEvent) => {
    if (isInsideCoreDialog(event.target as HTMLElement)) {
      return;
    }

    // If clicking on button that open panel -  don't trigger outside click processing
    if (buttonRef?.current && buttonRef?.current.contains(event.target as Node)) {
      return;
    }

    // If clicking the panel, this is not an outside clicked
    if (panelRef.current && panelRef?.current.contains(event.target as Node)) {
      return;
    }

    // If we reach this point, we got an outside clicked, no close the popup
    setIsSettingsOpen(false);

  }, [isInsideCoreDialog]);

  return (
    <>
      <Button disabled={props.disabled} styleType="borderless" title={buttonTooltip} className="maplayers-settings-popup-button" onClick={togglePopupDisplay} ref={buttonRef}>
        <WebFontIcon iconName="icon-settings" />
      </Button>
      <Popup
        isOpen={isSettingsOpen}
        position={RelativePosition.BottomRight}
        onClose={handleCloseSetting}
        target={buttonRef.current}
        onOutsideClick={handleOutsideClick}
        repositionOnResize={true}
      >
        <div ref={panelRef} className="maplayers-settings-popup-panel">
          <MapManagerSettings />
        </div>
      </Popup >
    </ >
  );
}
