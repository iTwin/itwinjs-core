/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Color
 */

// cSpell:ignore colorpicker

import * as React from "react";
import { ColorDef, HSVColor } from "@bentley/imodeljs-common";
import { ColorSwatch } from "./Swatch.js";
import { HueSlider } from "./HueSlider.js";
import { SaturationPicker } from "./SaturationPicker.js";
import "./ColorPickerPanel.scss";

/** Properties for the [[ColorPickerPanel]] React component
 * @beta
 */
export interface ColorPickerPanelProps {
  activeColor: ColorDef;
  onColorChange: (selectedColor: ColorDef) => void;
  colorPresets?: ColorDef[];
}

/**
 * Color Picker Dialog to use as modal dialog.
 * @beta
 */
// istanbul ignore next
export function ColorPickerPanel({ activeColor, onColorChange, colorPresets }: ColorPickerPanelProps) {

  const handlePresetColorPick = React.useCallback((newColor: ColorDef, e: React.MouseEvent<Element, MouseEvent>) => {
    e.preventDefault();
    if (onColorChange) {
      onColorChange(newColor);
    }
  }, [onColorChange]);

  const handleHueChange = React.useCallback((newHsvColor: HSVColor) => {
    // for a ColorDef to be created from hsv s can't be 0
    if (newHsvColor.s === 0) {
      newHsvColor = newHsvColor.clone(undefined, 0.5);
    }

    const newColorDef = newHsvColor.toColorDef();
    if (onColorChange) {
      onColorChange(newColorDef);
    }
  }, [onColorChange]);

  const handleSaturationChange = React.useCallback((newHsvColor: HSVColor) => {
    const newColorDef = newHsvColor.toColorDef();
    if (onColorChange) {
      onColorChange(newColorDef);
    }
  }, [onColorChange]);

  const currentHsv = React.useMemo(() => activeColor.toHSV(), [activeColor]);

  return (
    <div data-testid="components-colorpicker-panel" className="components-colorpicker-panel">
      <div className="components-colorpicker-panel-color">
        <div className="components-colorpicker-saturation">
          <SaturationPicker hsv={currentHsv} onSaturationChange={handleSaturationChange} />
        </div>
        <div className="components-colorpicker-hue">
          <HueSlider hsv={currentHsv} onHueChange={handleHueChange} isHorizontal={false} />
        </div>
      </div>
      {
        colorPresets && colorPresets.length &&
        <div className="components-colorpicker-panel-presets">
          {colorPresets.map((preset, index) => <ColorSwatch className="components-colorpicker-panel-swatch" key={index} colorDef={preset} round={false} onColorPick={handlePresetColorPick} />)}
        </div>
      }
    </div>
  );
}
