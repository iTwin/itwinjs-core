/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Color
 */

// cSpell:ignore colorpicker

import * as React from "react";
import classnames from "classnames";
import { ColorByName, ColorDef } from "@bentley/imodeljs-common";
import { RelativePosition } from "@bentley/ui-abstract";
import { CommonProps, Popup, useRefs, WebFontIcon } from "@bentley/ui-core";
import { ColorPickerPanel } from "./ColorPickerPanel";

import "./ColorPickerPopup.scss";
import { getCSSColorFromDef } from "./getCSSColorFromDef";

/** Properties for the [[ColorPickerPopup]] React component
 * @beta
 */
export interface ColorPickerPopupProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, CommonProps {
  /** Current color */
  initialColor: ColorDef;
  /** Preset colors. Pass undefined to show default preset colors. Pass empty array to show no presets. */
  colorDefs?: ColorDef[];
  /** Function to call when the color value is changed */
  onColorChange?: ((newColor: ColorDef) => void) | undefined;
  /** Function to call when the popup is closed */
  onClose?: ((colorValue: ColorDef) => void) | undefined;
  /** Disabled or not */
  disabled?: boolean;
  /** Readonly or not, color displayed on button but button will not trigger pop-up */
  readonly?: boolean;
  /** popup position. If not set RelativePosition.BottomLeft is used */
  popupPosition?: RelativePosition;
  /** Provides ability to return reference to HTMLButtonElement */
  ref?: React.Ref<HTMLButtonElement>;
  /** If true show up/down caret next to color  */
  showCaret?: boolean;
  /** If true, don't propagate clicks out of the ColorPicker */
  captureClicks?: boolean;
}

// Defined using following pattern (const ColorPickerPopup at bottom) to ensure useful API documentation is extracted

const ForwardRefColorPickerPopup = React.forwardRef<HTMLButtonElement, ColorPickerPopupProps>(
  function ForwardRefColorPickerPopup(props, ref) {
    const target = React.useRef<HTMLButtonElement>();
    const refs = useRefs(target, ref);  // combine ref needed for target with the forwardRef needed by the Parent when parent is a Type Editor.
    const [showPopup, setShowPopup] = React.useState(false);
    const [colorDef, setColorDef] = React.useState(props.initialColor);

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

    // istanbul ignore next
    const closePopup = React.useCallback(() => {
      props.onClose && props.onClose(colorDef);
      setShowPopup(false);
    }, [colorDef, props]);

    const togglePopup = React.useCallback(() => {
      setShowPopup(!showPopup);
    }, [showPopup]);

    const handleColorChanged = React.useCallback((newColor: ColorDef) => {
      // istanbul ignore else
      if (!newColor.equals(colorDef)) {
        setColorDef(newColor);

        // istanbul ignore else
        props.onColorChange && props.onColorChange(newColor);
      }
    }, [colorDef, props]);

    const rgbaString = getCSSColorFromDef(colorDef);

    const buttonStyle = { ...props.style } as React.CSSProperties;
    const swatchStyle = { backgroundColor: rgbaString } as React.CSSProperties;
    const buttonClassNames = classnames("components-colorpicker-popup-button",
      props.readonly && "readonly",
      props.className,
    );

    const clickHandler = (event: React.MouseEvent) => {
      // istanbul ignore else
      if (props.captureClicks)
        event.stopPropagation();
    };

    const colorOptions = props.colorDefs && props.colorDefs.length ? props.colorDefs : defaultColors.current;
    const popupPosition = undefined !== props.popupPosition ? props.popupPosition : RelativePosition.BottomLeft;
    return (
      /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
      <div onClick={clickHandler}>
        <button data-testid="components-colorpicker-popup-button" onClick={togglePopup} className={buttonClassNames} style={buttonStyle} disabled={props.disabled} ref={refs} >
          <div className="components-colorpicker-button-container">
            <div className="components-colorpicker-button-color-swatch" style={swatchStyle} />
            {props.showCaret && <WebFontIcon className="components-caret" iconName={showPopup ? "icon-caret-up" : "icon-caret-down"} iconSize="x-small" />}
          </div>
        </button>
        <Popup
          className="components-colorpicker-popup"
          isOpen={showPopup}
          position={popupPosition}
          onClose={closePopup}
          target={target.current}
          closeOnNestedPopupOutsideClick
        >
          <div className="components-colorpicker-popup-panel-padding">
            <ColorPickerPanel activeColor={colorDef} colorPresets={colorOptions} onColorChange={handleColorChanged} />
          </div>
        </Popup>
      </div>
    );
  }
);

/** ColorPickerButton component
 * @note Using forwardRef so the ColorEditor (Type Editor) can access the ref of the button element inside this component.
 * @beta
 */
export const ColorPickerPopup: (props: ColorPickerPopupProps) => JSX.Element | null = ForwardRefColorPickerPopup;
