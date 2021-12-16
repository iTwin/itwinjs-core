/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { RelativePosition } from "@itwin/appui-abstract";
import { IModelApp } from "@itwin/core-frontend";
import { Popup } from "@itwin/core-react";
import { Slider } from "@itwin/itwinui-react";

import "./TransparencyPopupButton.scss";

/** @alpha */
export interface TransparencyPopupButtonProps {
  /** initialValue range 0-1 */
  transparency: number;
  /** function called when value changes. Returned value range 0-1 */
  onTransparencyChange(value: number): void;
  /** optional tooltip */
  buttonToolTip?: string;
}

/** @alpha */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function TransparencyPopupButton({ transparency, onTransparencyChange, buttonToolTip }: TransparencyPopupButtonProps) {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [defaultTransparencyLabel] = React.useState(IModelApp.localization.getLocalizedString("mapLayers:TransparencyPopup.SetTransparency"));
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
      <button title={toolTipLabel} className="map-transparency-popup-button" onClick={togglePopupDisplay} ref={buttonRef}>
        <div className="transparent-button">
          <svg className="checkered" viewBox="0 0 24 24">
            <path d="m21.00427 0h-18.00854a2.9957 2.9957 0 0 0 -2.99573 2.99567v18.0086a2.99575 2.99575 0 0 0 2.99573 2.99573h18.00854a2.99575 2.99575 0 0 0 2.99573-2.99573v-18.0086a2.9957 2.9957 0 0 0 -2.99573-2.99567zm-20.00427 21.00427v-9.00427h11v-11h9.00427a1.998 1.998 0 0 1 1.99573 1.99567v9.00433h-11v11h-9.00427a1.998 1.998 0 0 1 -1.99573-1.99573z" />
          </svg>
        </div>
      </button>
      <Popup
        isOpen={isSettingsOpen}
        position={RelativePosition.BottomRight}
        onClose={handleCloseSetting}
        target={buttonRef.current}
      >
        <div className="map-transparency-popup-panel">
          <div className="map-transparency-slider-container">
            <Slider min={0} max={100} values={[transparency * 100]} step={1} onChange={handleTransparencyChange} />
          </div>
        </div>
      </Popup >
    </ >
  );
}
