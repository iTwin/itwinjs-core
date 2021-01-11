/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { RelativePosition } from "@bentley/ui-abstract";
import { Popup, Slider, WebFontIcon } from "@bentley/ui-core";
import { MapLayersUiItemsProvider } from "../MapLayersUiItemsProvider";
import "./MapLayerSettingsPopupButton.scss";
//import settingsIconSvg from "@bentley/icons-generic/icons/settings.svg?sprite";

/** @alpha */
export interface MapLayerSettingsButtonProps {
  /** initialValue range 0-1 */
  transparency: number;
  /** function called when value changes. Returned value range 0-1 */
  onTransparencyChange(value: number): void;
  /** optional tooltip */
  buttonToolTip?: string;
}

/** @alpha */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapLayerSettingsPopupButton({ transparency, onTransparencyChange, buttonToolTip }: MapLayerSettingsButtonProps) {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [defaultTransparencyLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:TransparencyPopup.SetTransparency"));
  const toolTipLabel = React.useMemo(() => buttonToolTip ? buttonToolTip : defaultTransparencyLabel, [buttonToolTip, defaultTransparencyLabel]);

  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const togglePopupDisplay = React.useCallback((event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();
    setIsSettingsOpen((prev) => !prev);
  }, [setIsSettingsOpen]);

  const handleCloseSetting = React.useCallback(() => {
    setIsSettingsOpen(false);
  }, [setIsSettingsOpen]);

  const handleTransparencyChange = React.useCallback((values: readonly number[]) => {
    if (values.length) {
      const newTransparency = values[0];
      if (newTransparency !== transparency) {
        if (onTransparencyChange)
          onTransparencyChange(newTransparency / 100);
      }
    }
  }, [onTransparencyChange, transparency]);

  return (
    <>
      <button title={toolTipLabel} className="maplayers-settings-popup-button" onClick={togglePopupDisplay} ref={buttonRef}>
        <WebFontIcon iconName="icon-settings" />
      </button>
      <Popup
        isOpen={isSettingsOpen}
        position={RelativePosition.BottomRight}
        onClose={handleCloseSetting}
        target={buttonRef.current}
      >
        <div className="maplayers-settings-popup-panel">
          <div className="maplayers-settings-container">
            <Slider min={0} max={100} values={[transparency * 100]} step={1} showTooltip showMinMax onChange={handleTransparencyChange} />
          </div>
        </div>
      </Popup >
    </ >
  );
}
