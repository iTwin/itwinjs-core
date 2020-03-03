/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Text
 */

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
export function StyledText(props: StyledTextProps) {
  const { mainClassName, className, style, children, ...spanProps } = props;

  return (
    <span {...spanProps} className={classnames(mainClassName, className)} style={style}>
      {children}
    </span>
  );
}
