/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore Modeless WMTS

import * as React from "react";
import { Dialog, DialogButtonType } from "@bentley/ui-core";
import { ModalDialogManager } from "@bentley/ui-framework";
import { ColorDef, HSVColor } from "@bentley/imodeljs-common";
import { ColorSwatch, HueSlider, SaturationPicker } from "@bentley/ui-components";
import "./BasemapColorDialog.scss";

export function BasemapColorDialog({ color, onOkResult, colorPresets }: { color: ColorDef, onOkResult: (selectedColor: ColorDef) => void, colorPresets?: ColorDef[] }) {
  const [dialogTitle] = React.useState("Specify Base Color");
  const [bgColor, setBgColor] = React.useState(color);

  const handleOk = React.useCallback(() => {
    ModalDialogManager.closeDialog();
    onOkResult(bgColor);
  }, [onOkResult, bgColor]);
  const dialogContainer = React.useRef<HTMLDivElement>(null);

  const handleCancel = React.useCallback(() => {
    ModalDialogManager.closeDialog();
  }, []);

  const handlePresetColorPick = React.useCallback((newColor: ColorDef, e: React.MouseEvent<Element, MouseEvent>) => {
    e.preventDefault();
    setBgColor(newColor);
  }, []);

  const handleHueOrSaturationChange = React.useCallback((newHsvColor: HSVColor) => {
    // for a ColorDef to be created from hsv s can't be 0
    if (newHsvColor.s === 0)
      newHsvColor = newHsvColor.clone(undefined, 0.5);

    setBgColor(newHsvColor.toColorDef());
  }, []);

  const buttonCluster = React.useMemo(() => [
    { type: DialogButtonType.OK, onClick: handleOk },
    { type: DialogButtonType.Cancel, onClick: handleCancel },
  ], [handleCancel, handleOk]);

  const colorSwatchStyle: React.CSSProperties = {
    width: `100%`,
    height: `100%`,
  };

  return (
    <div ref={dialogContainer}>
      <Dialog
        style={{ zIndex: 21000 }}
        title={dialogTitle}
        opened={true}
        resizable={true}
        movable={true}
        modal={true}
        buttonCluster={buttonCluster}
        onClose={handleCancel}
        onEscape={handleCancel}
        minHeight={120}
        maxWidth={400}
      >
        <div>
          <div className="basemap-color">
            <div className="basemap-color-top">
              <SaturationPicker hsv={bgColor.toHSV()} onSaturationChange={handleHueOrSaturationChange} />
            </div>
            <div className="basemap-color-bottom">
              <div className="basemap-color-bottom-left">
                <HueSlider hsv={bgColor.toHSV()} onHueChange={handleHueOrSaturationChange} isHorizontal={true} />
              </div>
              <div className="basemap-color-bottom-right">
                <ColorSwatch style={colorSwatchStyle} colorDef={bgColor} round={false} />
              </div>
            </div>
          </div>
          {
            colorPresets && colorPresets.length &&
            <div className="basemap-color-presets">
              {colorPresets.map((preset, index) => <ColorSwatch className="basemap-color-swatch" key={index} colorDef={preset} round={false} onColorPick={handlePresetColorPick} />)}
            </div>
          }
        </div>
      </Dialog>
    </div >
  );
}
