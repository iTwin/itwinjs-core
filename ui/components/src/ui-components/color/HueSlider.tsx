/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Color */

import * as React from "react";
import classnames from "classnames";

import { HSVColor } from "@bentley/imodeljs-common";
import { CommonProps } from "@bentley/ui-core";

import "./HueSlider.scss";

/** Properties for the [[HueSlider]] React component
 * @beta
 */
export interface HueSliderProps extends React.HTMLAttributes<HTMLDivElement>, CommonProps {
  /** true if slider is oriented horizontal, else vertical orientation is assumed */
  isHorizontal?: boolean;
  /** function to run when user selects color swatch */
  onHueChange?: ((hue: HSVColor) => void) | undefined;
  /** HSV Color Value */
  hsv: HSVColor;
}

/** HueSlider component used to set the hue value.
 * @beta
 */
export class HueSlider extends React.PureComponent<HueSliderProps> {
  private _container: HTMLDivElement | null = null;

  /** @internal */
  constructor(props: HueSliderProps) {
    super(props);
  }

  private _calculateChange = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, isHorizontal: boolean, hsv: HSVColor, container: HTMLDivElement): HSVColor | undefined => {
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

    const left = x - (containerLeft + window.pageXOffset);
    const top = y - (containerTop + window.pageYOffset);
    const newColor = this.props.hsv.clone();

    if (!isHorizontal) {
      let h;
      // istanbul ignore next
      if (top < 0) {
        h = 360;
      } else if (top > containerHeight) {
        h = 0;
      } else {
        const percent = -((top * 100) / containerHeight) + 100;
        h = ((360 * percent) / 100);
      }

      if (hsv.h !== h) {
        newColor.h = h;
        return newColor;
      }
    } else {  // horizontal
      let h;
      // istanbul ignore next
      if (left < 0) {
        h = 0;
      } else if (left > containerWidth) {
        h = 360;
      } else {
        const percent = (left * 100) / containerWidth;
        h = ((360 * percent) / 100);
      }

      // istanbul ignore else
      if (hsv.h !== h) {
        newColor.h = h;
        return newColor;
      }
    }
    // istanbul ignore next
    return undefined;
  }

  /** @internal */
  public componentWillUnmount() {
    this._unbindEventListeners();
  }

  private _onChange = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget)
      return;
    if (this._container && this.props.onHueChange) {
      const change = this._calculateChange(e, this.props.isHorizontal ? this.props.isHorizontal : false, this.props.hsv, this._container);
      change && typeof this.props.onHueChange === "function" && this.props.onHueChange(change);
    }
  }

  private _onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget)
      return;
    this._onChange(e);
    // istanbul ignore else
    if (this._container)
      this._container.focus();
    window.addEventListener("mousemove", this._onChange as any);
    window.addEventListener("mouseup", this._onMouseUp);
  }

  private _onKeyDown = (evt: React.KeyboardEvent<HTMLDivElement>) => {
    let newHue: number | undefined;
    const hueValue = this.props.hsv.clone();
    if (evt.key === "ArrowLeft" || evt.key === "ArrowDown") {
      newHue = hueValue.h - (evt.ctrlKey ? 10 : 1);
    } else if (evt.key === "ArrowRight" || evt.key === "ArrowUp") {
      newHue = hueValue.h + (evt.ctrlKey ? 10 : 1);
    } else if (evt.key === "PageDown") {
      newHue = hueValue.h - (evt.ctrlKey ? 180 : 60);
    } else if (evt.key === "PageUp") {
      newHue = hueValue.h + (evt.ctrlKey ? 180 : 60);
    } else if (evt.key === "Home") {
      newHue = 0;
    } else if (evt.key === "End") {
      newHue = 360;
    }

    // istanbul ignore else
    if (undefined !== newHue) {
      const newColor = this.props.hsv.clone();
      // istanbul ignore if
      if (newHue > 360) newHue = 360;
      // istanbul ignore if
      if (newHue < 0) newHue = 0;
      newColor.h = newHue;
      // istanbul ignore else
      if (this.props.onHueChange)
        this.props.onHueChange(newColor);
    }
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
    const containerClasses = classnames(
      this.props.isHorizontal ? "components-hue-container-horizontal" : "components-hue-container-vertical",
      this.props.className,
    );

    const pointerStyle: React.CSSProperties = this.props.isHorizontal ? {
      left: `${(this.props.hsv.h * 100) / 360}%`,
    } : {
        left: `0px`,
        top: `${-((this.props.hsv.h * 100) / 360) + 100}%`,
      };

    return (
      <div className={containerClasses} style={this.props.style} data-testid="hue-container">
        <div
          data-testid="hue-slider"
          role="slider" aria-label="Hue"
          aria-valuemin={0} aria-valuemax={360} aria-valuenow={this.props.hsv.h}
          className="components-hue-slider"
          ref={(container) => this._container = container}
          onMouseDown={this._onMouseDown}
          onTouchMove={this._onChange}
          onTouchStart={this._onChange}
          tabIndex={0}
          onKeyDown={this._onKeyDown}
        >
          <div style={pointerStyle} className="components-hue-pointer" data-testid="hue-pointer" />
        </div>
      </div>
    );
  }

}
