/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Color */

import * as React from "react";
import classnames from "classnames";
import "./Swatch.scss";
import { ColorDef } from "@bentley/imodeljs-common";

/** Properties for the [[ColorSwatch]] React component */
export interface ColorSwatchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** color specification */
  colorDef: ColorDef;
  /** function to run when user selects color swatch */
  onColorPick?: ((color: ColorDef, e: React.MouseEvent) => void) | undefined;
  /** Show swatches as squares unless round is set to true */
  round?: boolean;
}

/** ColorSwatch Functional component */
// tslint:disable-next-line:variable-name
export const ColorSwatch: React.FunctionComponent<ColorSwatchProps> = (props) => {
  const { b, g, r, t } = props.colorDef.colors as any;

  const rgbaString = `rgb(${r},${g},${b},${(255 - t) / 255})`;
  const colorStyle: React.CSSProperties = { backgroundColor: rgbaString };

  const handleClick = (e: React.MouseEvent) => {
    if (props && props.onColorPick)
      props.onColorPick(props.colorDef, e);
  };

  const classes = classnames("components-color-swatch", props.className, props.round && "round" );

  const {
    onColorPick, colorDef, round, // do not pass on color swatch specific props
    ...otherProps /* tslint:disable-line: trailing-comma */ // pass-through props
  } = props as any;

  return <button {...otherProps} style={colorStyle} className={classes} onClick={handleClick} />;
};
