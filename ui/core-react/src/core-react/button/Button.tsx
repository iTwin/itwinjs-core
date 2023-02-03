/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Button
 */

import * as React from "react";
import { Button as ITwinUI_Button, ButtonProps as ITwinUI_ButtonProps } from "@itwin/itwinui-react";
import { CommonProps } from "../utils/Props";

/** Sizes for [[Button]] component
 * @public
 * @deprecated in 3.0. Use `size` prop for itwinui-react Button instead
 */
export enum ButtonSize {
  Default = "",
  Large = "large",
}

/** Types for [[Button]] component
 * @public
 * @deprecated in 3.0. Use `styleType` prop for itwinui-react Button instead
 */
export enum ButtonType {
  Primary = "primary",
  Blue = "blue",
  Disabled = "disabled",
  Hollow = "hollow",
}

/** Properties for [[Button]] component
 * @public
 * @deprecated in 3.0. Use ButtonProps from itwinui-react instead
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, CommonProps {
  /** Allow ID to be passed to Button */
  id?: string;
  /** Default and large sizes */
  size?: ButtonSize;  // eslint-disable-line deprecation/deprecation
  /** 4 styles to tweak the content of the button */
  buttonType?: ButtonType;    // eslint-disable-line deprecation/deprecation
  /** A function to be run when the element is clicked */
  onClick?: ((event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void);
}

/** Generic button component
 * @public
 * @deprecated in 3.0. Use Button from itwinui-react instead
 */
export class Button extends React.PureComponent<ButtonProps> {    // eslint-disable-line deprecation/deprecation
  private getIuiButtonType = (buttonType?: ButtonType) => {   // eslint-disable-line deprecation/deprecation
    let iuiButtonType: ITwinUI_ButtonProps["styleType"];
    switch (buttonType) {
      case ButtonType.Blue: // eslint-disable-line deprecation/deprecation
        iuiButtonType = "high-visibility";
        break;
      case ButtonType.Hollow: // eslint-disable-line deprecation/deprecation
        iuiButtonType = "default";
        break;
      case ButtonType.Primary:  // eslint-disable-line deprecation/deprecation
      default:
        iuiButtonType = "cta";
        break;
    }
    return iuiButtonType;
  };

  public override render() {
    const { buttonType, size, className, style, onClick, ...props } = this.props;

    const iuiButtonType = this.getIuiButtonType(buttonType);

    // eslint-disable-next-line deprecation/deprecation
    return <ITwinUI_Button {...props} className={className} style={style} onClick={onClick} styleType={iuiButtonType} size={size === ButtonSize.Large ? undefined : "small"} />;
  }
}

/** @internal */
export function getButtonTypeClassName(buttonType?: ButtonType): string { // eslint-disable-line deprecation/deprecation
  let typeClassName: string;
  switch (buttonType) {
    case ButtonType.Blue: // eslint-disable-line deprecation/deprecation
      typeClassName = "uicore-buttons-blue";
      break;
    case ButtonType.Disabled: // eslint-disable-line deprecation/deprecation
      typeClassName = "uicore-buttons-disabled";
      break;
    case ButtonType.Hollow: // eslint-disable-line deprecation/deprecation
      typeClassName = "uicore-buttons-hollow";
      break;
    case ButtonType.Primary:  // eslint-disable-line deprecation/deprecation
    default:
      typeClassName = "uicore-buttons-primary";
      break;
  }
  return typeClassName;
}
