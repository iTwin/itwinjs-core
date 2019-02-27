/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Color */

import * as React from "react";
import classnames from "classnames";
import "./Swatch.scss";

/** Properties for the [[ColorSwatch]] React component */
export interface ColorSwatchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** color specification that must be in one of the following forms:
   * "rgb(255,0,0)"*
   * "rgba(255,0,0,255)"*
   * "rgb(100%,0%,0%)"*
   * "hsl(120,50%,50%)"*
   * "#rrbbgg"*
   * "#rrbbggaa"*
   */
  color: string;
  /** function to run when user selects color swatch */
  onColorPick?: ((color: string, e: React.MouseEvent) => void) | undefined;
  /** Show swatches as squares unless round is set to true */
  round?: boolean;
}

/** ColorSwatch Functional component */
// tslint:disable-next-line:variable-name
export const ColorSwatch: React.FunctionComponent<ColorSwatchProps> = (props) => {
  const colorStyle = { background: props.color } as React.CSSProperties;

  const handleClick = (e: React.MouseEvent) => {
    if (props && props.onColorPick)
      props.onColorPick(props.color, e);
  };

  const classes = classnames("components-color-swatch",
    props.className,
    props.round && "components-color-swatch-round",
  );

  const {
    onColorPick, color, round, // do not pass on color swatch specific props
    ...otherProps /* tslint:disable-line: trailing-comma */ // pass-through props
  } = props as any;

  return <button {...otherProps} style={colorStyle} className={classes} onClick={handleClick} />;
};
