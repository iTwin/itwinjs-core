/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Inputs */

import * as React from "react";
import * as classnames from "classnames";

/** Properties for the [[Input]] component
 * @beta
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { }

/** Basic text input
 * @beta
 */
export class Input extends React.Component<InputProps> {
  public render(): JSX.Element {
    return (
      <input {...this.props}
        className={classnames("uicore-inputs-input", this.props.className)} />
    );
  }
}
