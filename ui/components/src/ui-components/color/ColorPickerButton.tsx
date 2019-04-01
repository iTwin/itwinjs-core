/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Color */

import * as React from "react";
import classnames from "classnames";
import { ColorDef, ColorByName } from "@bentley/imodeljs-common";
import { Popup, Position } from "@bentley/ui-core";
import { ColorSwatch } from "./Swatch";
import "./ColorPickerButton.scss";

// cSpell:ignore colorpicker

/** Properties for the [[ColorPickerButton]] React component
 * @beta
 */
export interface ColorPickerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
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
      props.colorDefs.forEach((color: ColorDef) => { this._colors.push(color.clone()); });
    } else {
      ColorPickerButton.defaultColors.forEach((color: ColorDef) => { this._colors.push(color.clone()); });
    }
    this.state = { showPopup: false };
  }

  public static get defaultColors(): ColorDef[] {
    return [
      new ColorDef(ColorByName.red),
      new ColorDef(ColorByName.orange),
      new ColorDef(ColorByName.yellow),
      new ColorDef(ColorByName.green),
      new ColorDef(ColorByName.blue),
      new ColorDef(ColorByName.indigo),
      new ColorDef(ColorByName.violet),
      new ColorDef(ColorByName.black),
      new ColorDef(ColorByName.white),
      new ColorDef(ColorByName.cyan),
      new ColorDef(ColorByName.fuchsia),
      new ColorDef(ColorByName.tan),
      new ColorDef(ColorByName.gray),
      new ColorDef(ColorByName.brown),
      new ColorDef(ColorByName.purple),
      new ColorDef(ColorByName.olive),
    ];
  }

  private _togglePopup = () => {
    if (this.props.readonly)
      return;

    this.setState((_prevState) => ({ showPopup: !this.state.showPopup }));
  }

  private _closePopup = () => {
    this.setState((_prevState) => ({ showPopup: false }));
  }

  private _handleColorPicked = (color: ColorDef) => {
    this._closePopup();
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
    const colorStyle = { backgroundColor: rgbaString } as React.CSSProperties;
    const buttonName = classnames("components-colorpicker-button",
      this.props.round && "round",
      this.props.readonly && "readonly",
      this.props.className);

    return (
      <>
        <button data-testid="components-colorpicker-button" onClick={this._togglePopup} className={buttonName} style={colorStyle} disabled={this.props.disabled} ref={(element) => { this._target = element; }} />
        <Popup
          className="components-colorpicker-popup"
          isOpen={this.state.showPopup}
          position={Position.BottomLeft}
          onClose={this._closePopup}
          target={this._target} >
          {this.renderPopup(this.props.dropDownTitle)}
        </Popup>
      </>
    );
  }

}
