/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Color */

import * as React from "react";
import classnames from "classnames";

import { HSVColor } from "@bentley/imodeljs-common";
import { CommonProps } from "@bentley/ui-core";

import "./SaturationPicker.scss";

/** Properties for the [[SaturationPicker]] React component
 * @beta
 */
export interface SaturationPickerProps extends React.HTMLAttributes<HTMLDivElement>, CommonProps {
  /** function to run when user selects location in saturation region */
  onSaturationChange?: ((saturation: HSVColor) => void) | undefined;
  /** HSV Color Value */
  hsv: HSVColor;
}

/** SaturationPicker component used to set the saturation value.
 * @beta
 */
export class SaturationPicker extends React.PureComponent<SaturationPickerProps> {
  private _container: HTMLDivElement | null = null;

  /** @internal */
  constructor(props: SaturationPickerProps) {
    super(props);
  }

  private _calculateChange = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, hsv: HSVColor, container: HTMLDivElement): HSVColor | undefined => {
    e.preventDefault();
    const { width: containerWidth, height: containerHeight, top: containerTop, left: containerLeft } = container.getBoundingClientRect();

    let x = 0;
    if ("pageX" in e) {
      x = (e as React.MouseEvent<HTMLDivElement>).pageX;
    } else {
      // istanbul ignore if
      if (undefined === e.touches)
        return undefined;
      x = (e as React.TouchEvent<HTMLDivElement>).touches[0].pageX;
    }
    // istanbul ignore if
    if (undefined === x)
      return undefined;

    let y = 0;
    if ("pageY" in e) {
      y = (e as React.MouseEvent<HTMLDivElement>).pageY;
    } else {
      // istanbul ignore if
      if (undefined === e.touches)
        return;
      y = (e as React.TouchEvent<HTMLDivElement>).touches[0].pageY;
    }
    // istanbul ignore if
    if (undefined === y)
      return undefined;

    let left = x - (containerLeft + window.pageXOffset);
    let top = y - (containerTop + window.pageYOffset);

    // istanbul ignore next
    if (left < 0) {
      left = 0;
    } else if (left > containerWidth) {
      left = containerWidth;
    } else if (top < 0) {
      top = 0;
    } else if (top > containerHeight) {
      top = containerHeight;
    }

    let saturation = (left * 100) / containerWidth;
    let value = -((top * 100) / containerHeight) + 100;

    // istanbul ignore if
    if (saturation < 0) saturation = 0;
    // istanbul ignore if
    if (saturation > 100) saturation = 100;
    // istanbul ignore if
    if (value < 0) value = 0;
    // istanbul ignore if
    if (value > 100) value = 100;

    const newColor = new HSVColor();
    newColor.h = hsv.h;
    newColor.s = saturation;
    newColor.v = value;
    return newColor;
  }

  /** @internal */
  public componentWillUnmount() {
    this._unbindEventListeners();
  }

  private _onChange = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (this._container && this.props.onSaturationChange) {
      const change = this._calculateChange(e, this.props.hsv, this._container);
      change && typeof this.props.onSaturationChange === "function" && this.props.onSaturationChange(change);
    }
  }

  private _onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    this._onChange(e);
    // istanbul ignore else
    if (this._container)
      this._container.focus();
    window.addEventListener("mousemove", this._onChange as any);
    window.addEventListener("mouseup", this._onMouseUp);
  }

  private _onKeyDown = (evt: React.KeyboardEvent<HTMLDivElement>) => {
    const newColor = this.props.hsv.clone();
    if (evt.key === "ArrowLeft") {
      newColor.s -= (evt.ctrlKey ? 10 : 1);
    } else if (evt.key === "ArrowDown") {
      newColor.v -= (evt.ctrlKey ? 10 : 1);
    } else if (evt.key === "ArrowRight") {
      newColor.s += (evt.ctrlKey ? 10 : 1);
    } else if (evt.key === "ArrowUp") {
      newColor.v += (evt.ctrlKey ? 10 : 1);
    } else if (evt.key === "PageDown") {
      newColor.v = 0;
    } else if (evt.key === "PageUp") {
      newColor.v = 100;
    } else if (evt.key === "Home") {
      newColor.s = 0;
    } else if (evt.key === "End") {
      newColor.s = 100;
    }

    // istanbul ignore if
    if (newColor.s < 0) newColor.s = 0;
    // istanbul ignore if
    if (newColor.s > 100) newColor.s = 100;
    // istanbul ignore if
    if (newColor.v < 0) newColor.v = 0;
    // istanbul ignore if
    if (newColor.v > 100) newColor.v = 100;

    // istanbul ignore else
    if (this.props.onSaturationChange)
      this.props.onSaturationChange(newColor);
  }

  private _onMouseUp = () => {
    this._unbindEventListeners();
  }

  private _unbindEventListeners() {
    window.removeEventListener("mousemove", this._onChange as any);
    window.removeEventListener("mouseup", this._onMouseUp);
  }

  /** @internal */
  public render(): React.ReactNode {

    const pointerStyle: React.CSSProperties = {
      left: `${this.props.hsv.s}%`,
      top: `${-(this.props.hsv.v) + 100}%`,
    };

    const colorStyle: React.CSSProperties = {
      backgroundColor: `hsl(${this.props.hsv.h},100%, 50%)`,
    };

    return (
      <div className={classnames("components-saturation-container", this.props.className)} style={this.props.style} data-testid="saturation-container">
        <div
          data-testid="saturation-region"
          role="slider" aria-label="Saturation"
          style={colorStyle}
          className="components-saturation-region"
          ref={(container) => this._container = container}
          onMouseDown={this._onMouseDown}
          onTouchMove={this._onChange}
          onTouchStart={this._onChange}
          tabIndex={0}
          onKeyDown={this._onKeyDown}
        >
          <div style={pointerStyle} className="components-saturation-pointer" data-testid="saturation-pointer" />
        </div>
      </div>
    );
  }

}
