/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AccuDraw
 */

import * as React from "react";
import classnames from "classnames";
import { Button, ButtonType, ButtonProps, Omit } from "@bentley/ui-core";

import "./SquareButton.scss";

/** @alpha */
export interface SquareButtonProps extends Omit<ButtonProps, "size" | "buttonType"> { }

/** @alpha */
export class SquareButton extends React.PureComponent<SquareButtonProps> {
  public render() {
    const { className, style, ...buttonProps } = this.props;

    const buttonClassNames = classnames(
      "uifw-square-button",
      className,
    );
    const buttonStyle: React.CSSProperties = {
      ...style,
    };

    return (
      <Button {...buttonProps} buttonType={ButtonType.Hollow} className={buttonClassNames} style={buttonStyle} />
    );
  }
}
