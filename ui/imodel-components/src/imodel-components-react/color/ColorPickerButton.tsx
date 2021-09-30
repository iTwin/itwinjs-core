/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Color
 */

import "./ColorPickerButton.scss";
import classnames from "classnames";
import * as React from "react";
import { ColorByName, ColorDef } from "@itwin/core-common";
import { RelativePosition } from "@itwin/appui-abstract";
import { CommonProps, Popup, useRefs, WebFontIcon } from "@itwin/core-react";
import { ColorSwatch } from "./Swatch";
import { getCSSColorFromDef } from "./getCSSColorFromDef";

// cSpell:ignore colorpicker

function ColorOptions({ handleColorPicked, options, numColumns, round, title }: { handleColorPicked: ((color: ColorDef) => void), options: ColorDef[], numColumns: number, round: boolean, title?: string }) {
  const containerStyle: React.CSSProperties = { gridTemplateColumns: `repeat(${numColumns}, 1fr)` };
  return (
    <div className="components-colorpicker-popup-container">
      {title && <h4>{title}</h4>}
      <div data-testid="components-colorpicker-popup-colors" className="components-colorpicker-popup-colors" style={containerStyle}>
        {options.map((color, index) => <ColorSwatch className="components-colorpicker-swatch" key={index} colorDef={color}
          onColorPick={handleColorPicked} round={round} />)}
      </div>
    </div>
  );
}

/** Properties for the [[ColorPickerButton]] React component
 * @beta
 */
export interface ColorPickerProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, CommonProps {
  /** Active color */
  initialColor: ColorDef;
  /** Available colors */
  colorDefs?: ColorDef[];
  /** Function to run when user selects color swatch */
  onColorPick?: ((color: ColorDef) => void) | undefined;
  /** Show swatches as squares unless round is set to true */
  round?: boolean;
  /** Disabled or not */
  disabled?: boolean;
  /** Readonly or not */
  readonly?: boolean;
  /** Title to show at top of DropDown */
  dropDownTitle?: string;
  /** Number of columns */
  numColumns?: number;
  /** Provides ability to return reference to HTMLButtonElement */
  ref?: React.Ref<HTMLButtonElement>;
  /** If true show up/down caret next to color  */
  showCaret?: boolean;
}

// Defined using following pattern (const ColorPickerButton at bottom) to ensure useful API documentation is extracted
const ForwardRefColorPickerButton = React.forwardRef<HTMLButtonElement, ColorPickerProps>(
  function ForwardRefColorPickerButton({ className, colorDefs, disabled, dropDownTitle, initialColor, numColumns, onColorPick, readonly, round, showCaret, style }, ref) {
    const target = React.useRef<HTMLButtonElement>();
    const refs = useRefs(target, ref);  // combine ref needed for target with the forwardRef needed by the Parent when parent is a Type Editor.
    const [showPopup, setShowPopup] = React.useState(false);
    const [colorDef, setColorDef] = React.useState(initialColor);

    // See if new initialColor props have changed since component mounted
    React.useEffect(() => {
      setColorDef(initialColor);
    }, [initialColor]);

    const defaultColors = React.useRef(
      [
        ColorDef.create(ColorByName.red),
        ColorDef.create(ColorByName.orange),
        ColorDef.create(ColorByName.yellow),
        ColorDef.create(ColorByName.green),
        ColorDef.create(ColorByName.blue),
        ColorDef.create(ColorByName.indigo),
        ColorDef.create(ColorByName.violet),
        ColorDef.create(ColorByName.black),
        ColorDef.create(ColorByName.white),
        ColorDef.create(ColorByName.cyan),
        ColorDef.create(ColorByName.fuchsia),
        ColorDef.create(ColorByName.tan),
        ColorDef.create(ColorByName.gray),
        ColorDef.create(ColorByName.brown),
        ColorDef.create(ColorByName.purple),
        ColorDef.create(ColorByName.olive),
      ]);

    const closePopup = React.useCallback(() => {
      setShowPopup(false);
    }, []);

    const togglePopup = React.useCallback(() => {
      setShowPopup(!showPopup);
    }, [showPopup]);

    const handleColorPicked = React.useCallback((color: ColorDef) => {
      closePopup();

      // istanbul ignore else
      if (!color.equals(colorDef)) {
        setColorDef(color);
        onColorPick && onColorPick(color);
      }
    }, [closePopup, colorDef, onColorPick]);

    const rgbaString = getCSSColorFromDef(colorDef);

    const buttonStyle = { ...style } as React.CSSProperties;
    const swatchStyle = { backgroundColor: rgbaString } as React.CSSProperties;

    const buttonClassNames = classnames("components-colorpicker-button",
      round && "round",
      readonly && "readonly",
      className,
    );

    const colorOptions = colorDefs && colorDefs.length ? colorDefs : defaultColors.current;
    return (
      <>
        <button data-testid="components-colorpicker-button" data-value={rgbaString} onClick={togglePopup} className={buttonClassNames}
          style={buttonStyle} disabled={disabled} ref={refs} >
          <div className="components-colorpicker-button-container">
            <div className="components-colorpicker-button-color-swatch" style={swatchStyle} />
            {showCaret && <WebFontIcon className="components-caret" iconName={showPopup ? "icon-caret-up" : "icon-caret-down"} iconSize="x-small" />}
          </div>
        </button>
        <Popup
          className="components-colorpicker-popup"
          isOpen={showPopup}
          position={RelativePosition.BottomLeft}
          onClose={closePopup}
          target={target.current}
          closeOnNestedPopupOutsideClick
        >
          <ColorOptions handleColorPicked={handleColorPicked} options={colorOptions} numColumns={numColumns ?? 4} round={!!round} title={dropDownTitle} />
        </Popup>
      </>
    );
  }
);

/** ColorPickerButton component
 * @note Using forwardRef so the ColorEditor (Type Editor) can access the ref of the button element inside this component.
 * @beta
 */
export const ColorPickerButton: (props: ColorPickerProps) => JSX.Element | null = ForwardRefColorPickerButton;

