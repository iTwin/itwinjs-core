/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Color */

import * as React from "react";
import classnames from "classnames";
import { ColorDef, ColorByName } from "@bentley/imodeljs-common";
import { Popup, Position } from "@bentley/ui-core";
import "./DropDownColorPicker.scss";
import { ColorSwatch } from "./Swatch";

/** Properties for the [[DropDownColorPicker]] React component */
export interface ColorPickerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** active color */
  activeColor: ColorDef;
  /** available colors */
  colorDefs?: ColorDef[];
  /** function to run when user selects color swatch */
  onColorPick?: ((color: ColorDef) => void) | undefined;
  /** Show swatches as squares unless round is set to true */
  round?: boolean;
  /** Title to show at top of DropDown */
  dropDownTitle?: string;
  /** Show Arrow */
  showArrow?: boolean;
  /** Show Shadow around Popup */
  showShadow?: boolean;
  /** Use StatusBar colors */
  showStatusBarColors?: boolean;
  /** Open popup on hover */
  onHover?: boolean;
}

interface ColorPickerState {
  showPopup: boolean;
}

/** DropDownColorPicker component */
export class DropDownColorPicker extends React.PureComponent<ColorPickerProps, ColorPickerState> {
  private _colors: ColorDef[] = [];

  constructor(props: ColorPickerProps) {
    super(props);

    if (props.colorDefs) {
      props.colorDefs.forEach((color: ColorDef) => { this._colors.push(color.clone()); });
    } else {
      DropDownColorPicker.defaultColors.forEach((color: ColorDef) => { this._colors.push(color.clone()); });
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
    this.setState((_prevState) => ({ showPopup: !this.state.showPopup }));
  }

  private _closePopup = () => {
    this.setState((_prevState) => ({ showPopup: false }));
  }

  private _handleColorPicked = (color: ColorDef) => {
    this._closePopup();
    if (this.props.onColorPick) {
      this.props.onColorPick(color);
    }
  }

  private renderPopup(title: string | undefined) {
    const header = title ? <h4>{title}</h4> : null;
    return (
      <div className="components-colorpicker-popup-container">
        {header}
        <div className="components-colorpicker-popup-colors">
          {this._colors.map((color, index) => <ColorSwatch key={index} colorDef={color} onColorPick={this._handleColorPicked} round={true} />)}
        </div>
      </div>
    );
  }

  public render() {
    const { b, g, r, t } = this.props.activeColor.colors as any;
    const rgbaString = `rgb(${r},${g},${b},${(255 - t) / 255})`;
    const colorStyle = { backgroundColor: rgbaString } as React.CSSProperties;

    const className = classnames("popupcolors", this.props.showStatusBarColors && "statusbarcolors");
    return (
      <div className="components-colorpicker-container" >
        <button onClick={this._togglePopup} className="components-colorpicker-button" style={colorStyle} />
        <Popup className={className} isShown={this.state.showPopup} position={Position.BottomLeft}
          onClose={this._closePopup} showArrow={this.props.showArrow ? this.props.showArrow : false} showShadow={this.props.showShadow ? this.props.showShadow : false}
          showOnHover={this.props.onHover ? this.props.onHover : false}>
          {this.renderPopup(this.props.dropDownTitle)}
        </Popup>
      </div>
    );
  }

}
