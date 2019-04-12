/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";
import { CommonProps } from "../utils/Props";

/** Properties for the [[Input]] component
 * @beta
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, CommonProps { }

/** Basic text input
 * @beta
 */
export class Input extends React.Component<InputProps> {
  public render(): JSX.Element {
    const { className, style, ...props } = this.props;
    return (
      <input {...props}
        className={classnames("uicore-inputs-input", className)} style={style} />
    );
  }
}
