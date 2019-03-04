/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Button */

import * as React from "react";
import * as classnames from "classnames";

/** Sizes for [[Button]] component */
export enum ButtonSize {
  Default = "",
  Large = "large",
}

/** Types for [[Button]] component */
export enum ButtonType {
  Primary = "primary",
  Blue = "blue",
  Disabled = "disabled",
  Hollow = "hollow",
}

/** Properties for [[Button]] component */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Allow ID to be passed to Button */
  id?: string;
  /** Default and large sizes */
  size?: ButtonSize;
  /** 4 styles to tweak the content of the button */
  type?: ButtonType;
  /** A function to be run when the element is clicked */
  onClick?: ((event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void);
}

/** Generic button component  */
export class Button extends React.Component<ButtonProps> {
  public render() {
    let className = "";

    switch (this.props.type) {
      case ButtonType.Blue:
        className = "uicore-buttons-blue";
        break;
      case ButtonType.Disabled:
        className = "uicore-buttons-disabled";
        break;
      case ButtonType.Hollow:
        className = "uicore-buttons-hollow";
        break;
      case ButtonType.Primary:
      default:
        className = "uicore-buttons-blue";
        break;
    }

    if (this.props.size === ButtonSize.Large)
      className += "-large";

    return <button {...this.props} className={classnames(className, this.props.className)} onClick={this.props.onClick} />;
  }
}

export default Button;
