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
import { ColorSwatch } from "./Swatch";
import { HueSlider } from "./HueSlider";
import { SaturationPicker } from "./SaturationPicker";
import "./ColorPickerPanel.scss";
import { NumberInput } from "@bentley/ui-core";

/** Properties for the [[ColorPickerPanel]] React component
 * @beta
 */
export interface ColorPickerPanelProps {
  activeColor: ColorDef;
  onColorChange: (selectedColor: ColorDef) => void;
  colorPresets?: ColorDef[];
  /** If true, show RGB values and allow them to be set */
  showRbgValues?: boolean;
}

/**
 * Color Picker Dialog to use as modal dialog.
 * @beta
 */
// istanbul ignore next
export function ColorPickerPanel({ activeColor, onColorChange, colorPresets, showRbgValues }: ColorPickerPanelProps) {

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
  const color = React.useMemo(() => activeColor.colors, [activeColor]);

  const handleRedChange = React.useCallback((value: number | undefined, _stringValue: string) => {
    if (undefined !== value) {
      const newColorDef = ColorDef.from(value, color.g, color.b);
      if (onColorChange) {
        onColorChange(newColorDef);
      }
    }
  }, [color, onColorChange]);

  const handleGreenChange = React.useCallback((value: number | undefined, _stringValue: string) => {
    if (undefined !== value) {
      const newColorDef = ColorDef.from(color.r, value, color.b);
      if (onColorChange) {
        onColorChange(newColorDef);
      }
    }
  }, [color, onColorChange]);

  const handleBlueChange = React.useCallback((value: number | undefined, _stringValue: string) => {
    if (undefined !== value) {
      const newColorDef = ColorDef.from(color.r, color.g, value);
      if (onColorChange) {
        onColorChange(newColorDef);
      }
    }
  }, [color, onColorChange]);

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
      {showRbgValues &&
        <div data-testid="components-colorpicker-rgb-panel" className="components-colorpicker-rgb-panel">
          <div className="components-colorpicker-rgb-value-wrapper">
            <span className="uicore-inputs-labeled-input">R</span>
            <NumberInput data-testid="components-colorpicker-rgb-value-red" value={color.r} onChange={handleRedChange} min={0} max={255} />
          </div>
          <div className="components-colorpicker-rgb-value-wrapper">
            <span className="uicore-inputs-labeled-input">G</span>
            <NumberInput data-testid="components-colorpicker-rgb-value-green" value={color.g} onChange={handleGreenChange} min={0} max={255} />
          </div>
          <div className="components-colorpicker-rgb-value-wrapper">
            <span className="uicore-inputs-labeled-input">B</span>
            <NumberInput data-testid="components-colorpicker-rgb-value-blue" value={color.b} onChange={handleBlueChange} min={0} max={255} />
          </div>
        </div>}
      {
        colorPresets && colorPresets.length &&
        <div className="components-colorpicker-panel-presets">
          {colorPresets.map((preset, index) => <ColorSwatch className="components-colorpicker-panel-swatch" key={index} colorDef={preset} round={false} onColorPick={handlePresetColorPick} />)}
        </div>
      }
    </div>
  );
}
