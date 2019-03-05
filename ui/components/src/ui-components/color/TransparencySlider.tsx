/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Color */

import * as React from "react";
import "./TransparencySlider.scss";
import classnames from "classnames";

/** Properties for the [[TransparencySlider]] React component */
export interface TransparencySliderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** true if slider is oriented horizontal, else vertical orientation is assumed */
  isHorizontal?: boolean;
  /** function to run when user selects color swatch */
  onTransparencyChange?: ((transparency: number) => void) | undefined;
  /** Transparency value between 0 and 1 */
  transparency: number;
}

/** TransparencySlider component used to set the transparency value. */
export class TransparencySlider extends React.PureComponent<TransparencySliderProps> {
  private _container: HTMLDivElement | null = null;

  constructor(props: TransparencySliderProps) {
    super(props);
  }

  private _calculateChange = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, isHorizontal: boolean, transparency: number, container: HTMLDivElement): number | undefined => {
    e.preventDefault();
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    // tslint:disable-next-line:no-console
    console.log(`containerWidth=${containerWidth} containerHeight=${containerHeight} `);

    let x = 0;
    if ("pageX" in e) {
      x = (e as React.MouseEvent<HTMLDivElement>).pageX;
    } else {
      if (undefined === e.touches)
        return undefined;
      x = (e as React.TouchEvent<HTMLDivElement>).touches[0].pageX;
    }
    if (undefined === x)
      return undefined;

    let y = 0;
    if ("pageY" in e) {
      y = (e as React.MouseEvent<HTMLDivElement>).pageY;
    } else {
      if (undefined === e.touches)
        return;
      y = (e as React.TouchEvent<HTMLDivElement>).touches[0].pageY;
    }
    if (undefined === y)
      return undefined;

    const left = x - (container.getBoundingClientRect().left + window.pageXOffset);
    const top = y - (container.getBoundingClientRect().top + window.pageYOffset);

    // tslint:disable-next-line:no-console
    console.log(`x=${x}, y=${y} left=${left}  top=${top} clientRect.left=${container.getBoundingClientRect().left} clientRect.top=${container.getBoundingClientRect().top}`);

    let t = transparency;

    if (!isHorizontal) {
      if (top < 0) {
        t = 1;
      } else if (top > containerHeight) {
        t = 0;
      } else {
        t = 1 - (top / containerHeight);
      }
    } else {  // horizontal
      if (left < 0) {
        t = 0;
      } else if (left > containerWidth) {
        t = 1;
      } else {
        t = left / containerWidth;
      }
    }

    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return (transparency !== t) ? t : undefined;
  }

  public componentWillUnmount() {
    this._unbindEventListeners();
  }

  private _onChange = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (this._container && this.props.onTransparencyChange) {
      const change = this._calculateChange(e, this.props.isHorizontal ? this.props.isHorizontal : false, this.props.transparency, this._container);
      undefined !== change && typeof this.props.onTransparencyChange === "function" && this.props.onTransparencyChange(change);
    }
  }

  private _onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    this._onChange(e);
    if (this._container)
      this._container.focus();
    window.addEventListener("mousemove", this._onChange as any);
    window.addEventListener("mouseup", this._onMouseUp);
  }

  private _onKeyDown = (evt: React.KeyboardEvent<HTMLDivElement>) => {
    let newTransparency: number | undefined;
    if (evt.key === "ArrowLeft" || evt.key === "ArrowDown") {
      newTransparency = this.props.transparency - (evt.ctrlKey ? .1 : .05);
    } else if (evt.key === "ArrowRight" || evt.key === "ArrowUp") {
      newTransparency = this.props.transparency + (evt.ctrlKey ? .1 : .05);
    } else if (evt.key === "PageDown") {
      newTransparency = this.props.transparency - (evt.ctrlKey ? .5 : .25);
    } else if (evt.key === "PageUp") {
      newTransparency = this.props.transparency + (evt.ctrlKey ? .5 : .25);
    } else if (evt.key === "Home") {
      newTransparency = 0;
    } else if (evt.key === "End") {
      newTransparency = 1;
    }

    if (undefined !== newTransparency) {
      if (newTransparency > 1) newTransparency = 1;
      if (newTransparency < 0) newTransparency = 0;
      if (this.props.onTransparencyChange)
        this.props.onTransparencyChange(newTransparency);
    }
  }

  private _onMouseUp = () => {
    this._unbindEventListeners();
  }

  private _unbindEventListeners() {
    window.removeEventListener("mousemove", this._onChange as any);
    window.removeEventListener("mouseup", this._onMouseUp);
  }

  public render(): React.ReactNode {
    const containerClasses = classnames(
      this.props.isHorizontal ? "components-transparency-container-horizontal" : "components-transparency-container-vertical",
    );

    const pointerStyle: React.CSSProperties = this.props.isHorizontal ? {
      left: `${(this.props.transparency * 100)}%`,
    } : {
        left: `0px`,
        top: `${-(this.props.transparency * 100) + 100}%`,
      };

    return (
      <div className={containerClasses} data-testid="transparency-container">
        <div
          data-testid="transparency-slider"
          role="slider" aria-label="Transparency"
          aria-valuemin={0} aria-valuemax={1} aria-valuenow={this.props.transparency}
          className="components-transparency-slider"
          ref={(container) => this._container = container}
          onMouseDown={this._onMouseDown}
          onTouchMove={this._onChange}
          onTouchStart={this._onChange}
          tabIndex={0}
          onKeyDown={this._onKeyDown}
        >
          <div style={pointerStyle} className="components-transparency-pointer" data-testid="transparency-pointer" />
        </div>
      </div>
    );
  }

}
