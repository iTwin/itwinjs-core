/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Color
 */

// cSpell:ignore colorpicker

import * as React from "react";
import type { HSVColor } from "@itwin/core-common";
import { ColorDef } from "@itwin/core-common";
import { ColorSwatch } from "./Swatch";
import { HueSlider } from "./HueSlider";
import { SaturationPicker } from "./SaturationPicker";
import "./ColorPickerPanel.scss";
import { NumberInput } from "@itwin/core-react";

/** Properties for the [[ColorPickerPanel]] React component
 * @public @deprecated use `ColorPicker` for itwinui-react
 */
export interface ColorPickerPanelProps {
  activeColor: ColorDef;
  onColorChange: (selectedColor: ColorDef) => void;
  colorPresets?: ColorDef[];
  /** If set show either HSL or RGB input values. If undefined no input value is shown */
  colorInputType?: "HSL" | "RGB";
}

/**
 * Color Picker Dialog to use as modal dialog.
 * @public @deprecated use `ColorPicker` for itwinui-react
 */
// istanbul ignore next
export function ColorPickerPanel({ activeColor, onColorChange, colorPresets, colorInputType }: ColorPickerPanelProps) { // eslint-disable-line deprecation/deprecation
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

  const currentHsl = React.useMemo(() => activeColor.toHSL(), [activeColor]);
  const currentHsv = React.useMemo(() => activeColor.toHSV(), [activeColor]);
  const color = React.useMemo(() => activeColor.colors, [activeColor]);

  const handleLightnessValueChange = React.useCallback((value: number | undefined, _stringValue: string) => {
    const newHsl = currentHsl.clone(undefined, undefined, (value ?? 0) / 100);

    if (onColorChange) {
      const newColorDef = newHsl.toColorDef();
      onColorChange(newColorDef);
    }
  }, [currentHsl, onColorChange]);

  const handleHueValueChange = React.useCallback((value: number | undefined, _stringValue: string) => {
    const newHsl = currentHsl.clone((value ?? 0) / 360, undefined, undefined);

    if (onColorChange) {
      const newColorDef = newHsl.toColorDef();
      onColorChange(newColorDef);
    }
  }, [currentHsl, onColorChange]);

  const handleSaturationValueChange = React.useCallback((value: number | undefined, _stringValue: string) => {
    const newHsl = currentHsl.clone(undefined, (value ?? 0) / 100, undefined);

    if (onColorChange) {
      const newColorDef = newHsl.toColorDef();
      onColorChange(newColorDef);
    }
  }, [currentHsl, onColorChange]);

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
      {(colorInputType === "RGB") &&
        <div data-testid="components-colorpicker-input-panel" className="components-colorpicker-input-panel">
          <div className="components-colorpicker-input-value-wrapper">
            <span className="uicore-inputs-labeled-input">R</span>
            <NumberInput data-testid="components-colorpicker-input-value-red" value={color.r} onChange={handleRedChange} min={0} max={255} />
          </div>
          <div className="components-colorpicker-input-value-wrapper">
            <span className="uicore-inputs-labeled-input">G</span>
            <NumberInput data-testid="components-colorpicker-input-value-green" value={color.g} onChange={handleGreenChange} min={0} max={255} />
          </div>
          <div className="components-colorpicker-input-value-wrapper">
            <span className="uicore-inputs-labeled-input">B</span>
            <NumberInput data-testid="components-colorpicker-input-value-blue" value={color.b} onChange={handleBlueChange} min={0} max={255} />
          </div>
        </div>}
      {(colorInputType === "HSL") &&
        <div data-testid="components-colorpicker-input-panel" className="components-colorpicker-input-panel">
          <div className="components-colorpicker-input-value-wrapper">
            <span className="uicore-inputs-labeled-input">H</span>
            <NumberInput data-testid="components-colorpicker-input-value-hue" value={Math.round(currentHsl.h * 360)} onChange={handleHueValueChange} min={0} max={360} />
          </div>
          <div className="components-colorpicker-input-value-wrapper">
            <span className="uicore-inputs-labeled-input">S</span>
            <NumberInput data-testid="components-colorpicker-input-value-saturation" value={Math.round(currentHsl.s * 100)} onChange={handleSaturationValueChange} min={0} max={100} />
          </div>
          <div className="components-colorpicker-input-value-wrapper">
            <span className="uicore-inputs-labeled-input">L</span>
            <NumberInput data-testid="components-colorpicker-input-value-lightness" value={Math.round(currentHsl.l * 100)} onChange={handleLightnessValueChange} min={0} max={100} />
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
