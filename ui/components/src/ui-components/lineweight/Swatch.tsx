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
  /** ref for Button that is to received focus. */
  focusRef?: React.Ref<HTMLButtonElement>;
}

/** LineWeightSwatch Functional component
 * @beta
 */
// tslint:disable-next-line:variable-name
export const LineWeightSwatch: React.FunctionComponent<LineWeightSwatchProps> = (props) => {

  const {
    onClick, colorDef, weight, hideLabel, focusRef, autoFocus, className, // do not pass on color swatch specific props
    disabled, readonly, ...otherProps /* tslint:disable-line: trailing-comma */ // pass-through props
  } = props as any;

  let rgbaString = "";

  if (colorDef) {
    const { b, g, r, t } = colorDef.colors as any;
    rgbaString = `rgb(${r},${g},${b},${(255 - t) / 255})`;
  }

  const buttonStyle: React.CSSProperties = colorDef ? {
    ...props.style,
    color: rgbaString,
  } : {
      ...props.style,
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
    autoFocus && "active",
    className,
  );

  const ref = props.autoFocus ? focusRef : null;

  return (
    <button {...otherProps} style={buttonStyle} className={classes} onClick={handleClick} ref={ref} disabled={disabled}>
      <span>{weight.toFixed(0)}</span>
      <div style={svgStyle} />
    </button>
  );
};

// <svg viewBox="0 0 120 24">
// <line x1="0" y1="12" x2="120" y2="12" strokeWidth={weight} />  /* stroke={rgbaString} */
// </svg>
