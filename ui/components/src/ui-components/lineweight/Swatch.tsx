/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module LineWeight */

import * as React from "react";
import classnames from "classnames";

import { ColorDef } from "@bentley/imodeljs-common";
import { CommonProps } from "@bentley/ui-core";

import "./Swatch.scss";

/** Properties for the [[LineWeightSwatch]] React component
 * @beta
 */
export interface LineWeightSwatchProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, CommonProps {
  /** color specification */
  weight: number;
  /** color specification */
  colorDef?: ColorDef;
  /** hide the weight label */
  hideLabel?: boolean;
  /** Disabled or not */
  disabled?: boolean;
  /** Readonly or not */
  readonly?: boolean;
  /** function to run when user selects a line weight swatch */
  onClick?: () => void;
}

/** LineWeightSwatch Functional component
 * @beta
 */
export class LineWeightSwatch extends React.PureComponent<LineWeightSwatchProps> {
  /** @internal */
  constructor(props: LineWeightSwatchProps) {
    super(props);
  }

  public componentDidMount() {
    // tslint:disable-next-line: no-console
    // console.log(`LineWeightSwatchProps.componentDidMount setFocusRef=${this.props.setFocusRef} focusRef=${this.props.focusRef && this.props.focusRef.current ? "set" : "unset"}`);
  }

  public render() {
    const {
      onClick, colorDef, weight, hideLabel, className, // do not pass on color swatch specific props
      disabled, readonly, ...otherProps /* tslint:disable-line: trailing-comma */ // pass-through props
    } = this.props as any;

    let rgbaString = "";

    if (colorDef) {
      const { b, g, r, t } = colorDef.colors as any;
      rgbaString = `rgb(${r},${g},${b},${(255 - t) / 255})`;
    }

    const buttonStyle: React.CSSProperties = colorDef ? {
      ...this.props.style,
      color: rgbaString,
    } : {
        ...this.props.style,
      };

    const svgStyle: React.CSSProperties = colorDef ? {
      height: `${weight}px`,
      background: rgbaString,
    } : {
        height: `${weight}px`,
      };

    const handleClick = (_e: React.MouseEvent) => {
      if (onClick)
        onClick();
    };

    const classes = classnames(
      "components-lineweight-swatch",
      hideLabel && "hide-label",
      readonly && "readonly",
      className,
    );

    return (
      <button {...otherProps} style={buttonStyle} className={classes} onClick={handleClick} disabled={disabled}>
        {!hideLabel && <span>{weight.toFixed(0)}</span>}
        <div style={svgStyle} />
      </button>
    );
  }
}
