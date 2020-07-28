/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Color
 */

// cSpell:ignore colorpicker

import * as React from "react";
import { Dialog, DialogButtonType } from "@bentley/ui-core";
import { ColorDef, HSVColor } from "@bentley/imodeljs-common";
import { ColorSwatch } from "./Swatch";
import { HueSlider } from "./HueSlider";
import { SaturationPicker } from "./SaturationPicker";
import "./ColorPickerDialog.scss";

/** Properties for the [[ColorPickerDialog]] React component
 * @beta
 */
export interface ColorPickerDialogProps {
  dialogTitle: string;
  color: ColorDef;
  onOkResult: (selectedColor: ColorDef) => void;
  onCancelResult: () => void;
  colorPresets?: ColorDef[];
}

/**
 * Color Picker Dialog to use as modal dialog.
 * @beta
 */
// istanbul ignore next
export function ColorPickerDialog({ dialogTitle, color, onOkResult, onCancelResult, colorPresets }: ColorPickerDialogProps) {
  const [bgColor, setBgColor] = React.useState(color);
  const dialogContainer = React.useRef<HTMLDivElement>(null);

  const handleOk = React.useCallback(() => {
    onOkResult(bgColor);
  }, [onOkResult, bgColor]);
  const handleCancel = React.useCallback(() => {
    if (onCancelResult)
      onCancelResult();
  }, [onCancelResult]);

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
          <div className="components-colorpicker-dialog">
            <div className="components-colorpicker-dialog-top">
              <SaturationPicker hsv={bgColor.toHSV()} onSaturationChange={handleHueOrSaturationChange} />
            </div>
            <div className="components-colorpicker-dialog-bottom">
              <div className="components-colorpicker-dialog-bottom-left">
                <HueSlider hsv={bgColor.toHSV()} onHueChange={handleHueOrSaturationChange} isHorizontal={true} />
              </div>
              <div className="components-colorpicker-dialog-bottom-right">
                <ColorSwatch style={colorSwatchStyle} colorDef={bgColor} round={false} />
              </div>
            </div>
          </div>
          {
            colorPresets && colorPresets.length &&
            <div className="components-colorpicker-dialog-presets">
              {colorPresets.map((preset, index) => <ColorSwatch className="components-colorpicker-dialog-swatch" key={index} colorDef={preset} round={false} onColorPick={handlePresetColorPick} />)}
            </div>
          }
        </div>
      </Dialog>
    </div >
  );
}
