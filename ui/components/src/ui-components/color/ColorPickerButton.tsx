/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Color
 */

import * as React from "react";
import classnames from "classnames";
import { ColorDef, ColorByName } from "@bentley/imodeljs-common";
import { RelativePosition } from "@bentley/ui-abstract";
import { Popup, CommonProps } from "@bentley/ui-core";
import { ColorSwatch } from "./Swatch";
import "./ColorPickerButton.scss";

// cSpell:ignore colorpicker

/** Properties for the [[ColorPickerButton]] React component
 * @beta
 */
export interface ColorPickerProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, CommonProps {
  /** active color */
  activeColor: ColorDef;
  /** available colors */
  colorDefs?: ColorDef[];
  /** function to run when user selects color swatch */
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
  numColumns: number;
}

/** @internal */
interface ColorPickerState {
  showPopup: boolean;
}

/** ColorPickerButton component
 * @beta
 */
export class ColorPickerButton extends React.PureComponent<ColorPickerProps, ColorPickerState> {
  private _colors: ColorDef[] = [];
  private _target: HTMLElement | null = null;

  /** @internal */
  public static defaultProps: Partial<ColorPickerProps> = {
    numColumns: 4,
  };

  /** @internal */
  constructor(props: ColorPickerProps) {
    super(props);

    if (props.colorDefs) {
      props.colorDefs.forEach((color: ColorDef) => { this._colors.push(color); });
    } else {
      ColorPickerButton.defaultColors.forEach((color: ColorDef) => { this._colors.push(color); });
    }
    this.state = { showPopup: false };
  }

  public static get defaultColors(): ColorDef[] {
    return [
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
    ];
  }

  private _togglePopup = () => {
    if (this.props.readonly)
      return;

    this.setState((prevState) => ({ showPopup: !prevState.showPopup }));
  }

  private _closePopup = () => {
    this.setState((_prevState) => ({ showPopup: false }));
  }

  public setFocus(): void {
    // istanbul ignore else
    if (this._target)
      this._target.focus();
  }

  private _handleColorPicked = (color: ColorDef) => {
    this._closePopup();
    // istanbul ignore else
    if (this.props.onColorPick)
      this.props.onColorPick(color);
  }

  private renderPopup(title: string | undefined) {
    const containerStyle: React.CSSProperties = { gridTemplateColumns: `repeat(${this.props.numColumns}, 1fr)` };
    return (
      <div className="components-colorpicker-popup-container">
        {title && <h4>{title}</h4>}
        <div data-testid="components-colorpicker-popup-colors" className="components-colorpicker-popup-colors" style={containerStyle}>
          {this._colors.map((color, index) => <ColorSwatch className="components-colorpicker-swatch" key={index} colorDef={color}
            onColorPick={this._handleColorPicked} round={this.props.round} />)}
        </div>
      </div>
    );
  }

  /** @internal */
  public render() {
    const { b, g, r, t } = this.props.activeColor.colors as any;
    const rgbaString = `rgb(${r},${g},${b},${(255 - t) / 255})`;
    const buttonStyle = { backgroundColor: rgbaString, ...this.props.style } as React.CSSProperties;
    const buttonClassNames = classnames("components-colorpicker-button",
      this.props.round && "round",
      this.props.readonly && "readonly",
      this.props.className,
    );

    return (
      <>
        <button data-testid="components-colorpicker-button" onClick={this._togglePopup} className={buttonClassNames} style={buttonStyle} disabled={this.props.disabled} ref={(element) => { this._target = element; }} />
        <Popup
          className="components-colorpicker-popup"
          isOpen={this.state.showPopup}
          position={RelativePosition.BottomLeft}
          onClose={this._closePopup}
          target={this._target} >
          {this.renderPopup(this.props.dropDownTitle)}
        </Popup>
      </>
    );
  }

}
