/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Text */

import * as React from "react";
import * as classnames from "classnames";
import { TextProps } from "./TextProps";

/** Styled body text
 * @beta
 */
export class BodyText extends React.Component<TextProps> {
  public render(): JSX.Element {
    const { className, style, ...props } = this.props;

    return (
      <span {...props} className={classnames("uicore-text-block", className)} style={style}>
        {this.props.children}
      </span>
    );
  }
}
