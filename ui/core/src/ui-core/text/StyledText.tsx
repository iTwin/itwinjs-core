/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Text */

import * as React from "react";
import * as classnames from "classnames";
import { TextProps } from "./TextProps";

/** Properties for [[StyledText]] component
 * @internal
 */
export interface StyledTextProps extends TextProps {
  /** Main CSS class name */
  mainClassName: string;
}

/** Styled text
 * @internal
 */
export class StyledText extends React.PureComponent<StyledTextProps> {
  public render(): JSX.Element {
    const { mainClassName, className, style, children, ...props } = this.props;

    return (
      <span {...props} className={classnames(mainClassName, className)} style={style}>
        {children}
      </span>
    );
  }
}
