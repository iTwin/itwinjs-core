/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Color
 */

// cSpell:ignore colorpicker

import * as React from "react";
import { DialogButtonType } from "@itwin/appui-abstract";
import { Dialog } from "@itwin/core-react";
import { ColorDef } from "@itwin/core-common";
import { ColorBuilder, ColorInputPanel, ColorPalette, ColorPicker, ColorValue } from "@itwin/itwinui-react";

/** Properties for the [[ColorPickerDialog]] React component
 * @beta
 */
export interface ColorPickerDialogProps {
  dialogTitle: string;
  color: ColorDef;
  onOkResult: (selectedColor: ColorDef) => void;
  onCancelResult: () => void;
  /** displayed in rows of 9 items */
  colorPresets?: ColorDef[];
  /** If set show either HSL, RGB, or HEX input values. If undefined no input value is shown */
  colorInputType?: "hsl" | "rgb" | "hex";
}

/**
 * Color Picker Dialog to use as modal dialog.
 * @beta
 */
export function ColorPickerDialog({ dialogTitle, color, onOkResult, onCancelResult, colorPresets, colorInputType }: ColorPickerDialogProps) {
  const [activeColor, setActiveColor] = React.useState(color);
  const dialogContainer = React.useRef<HTMLDivElement>(null);

  const handleOk = React.useCallback(() => {
    onOkResult(activeColor);
  }, [onOkResult, activeColor]);
  const handleCancel = React.useCallback(() => {
    // istanbul ignore else
    if (onCancelResult)
      onCancelResult();
  }, [onCancelResult]);

  const handleColorChanged = React.useCallback((newColorValue: ColorValue) => {
    const newColorDef = ColorDef.fromTbgr(newColorValue.toTbgr());
    setActiveColor(newColorDef);
  }, []);

  const buttonCluster = React.useMemo(() => [
    { type: DialogButtonType.OK, onClick: handleOk },
    { type: DialogButtonType.Cancel, onClick: handleCancel },
  ], [handleCancel, handleOk]);

  const colorOptions = React.useMemo(() => {
    if (colorPresets) {
      return colorPresets.map((def) => ColorValue.fromTbgr(def.tbgr));
    }
    return undefined;
  }, [colorPresets]);

  return (
    <div ref={dialogContainer}>
      <Dialog
        title={dialogTitle}
        opened={true}
        resizable={false}
        movable={true}
        modal={true}
        buttonCluster={buttonCluster}
        onClose={handleCancel}
        onEscape={handleCancel}
        minHeight={490}
        maxWidth={320}
      >
        <ColorPicker selectedColor={ColorValue.fromTbgr(activeColor.tbgr)} onChangeComplete={handleColorChanged} >
          <ColorBuilder />
          {colorInputType &&
            <ColorInputPanel defaultColorFormat={colorInputType} />}
          {colorOptions &&
            <ColorPalette colors={colorOptions} />}
        </ColorPicker>
      </Dialog>
    </div >
  );
}
