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
import { ColorPickerPanel } from "./ColorPickerPanel";

/** Properties for the [[ColorPickerDialog]] React component
 * @beta
 */
export interface ColorPickerDialogProps {
  dialogTitle: string;
  color: ColorDef;
  onOkResult: (selectedColor: ColorDef) => void;
  onCancelResult: () => void;
  colorPresets?: ColorDef[];
  /** If set show either HSL or RGB input values. If undefined no input value is shown */
  colorInputType?: "HSL" | "RGB";
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

  const handleColorChange = React.useCallback((newColorDef: ColorDef) => {
    setActiveColor(newColorDef);
  }, []);

  const buttonCluster = React.useMemo(() => [
    { type: DialogButtonType.OK, onClick: handleOk },
    { type: DialogButtonType.Cancel, onClick: handleCancel },
  ], [handleCancel, handleOk]);

  return (
    <div ref={dialogContainer}>
      <Dialog
        title={dialogTitle}
        opened={true}
        resizable={true}
        movable={true}
        modal={true}
        buttonCluster={buttonCluster}
        onClose={handleCancel}
        onEscape={handleCancel}
        minHeight={340}
        maxWidth={400}
      >
        <ColorPickerPanel colorInputType={colorInputType} activeColor={activeColor} colorPresets={colorPresets} onColorChange={handleColorChange} />
      </Dialog>
    </div >
  );
}
