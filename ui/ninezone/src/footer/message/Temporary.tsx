/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../../utilities/Props";
import "./Temporary.scss";

/** Properties of [[Temporary]] component. */
export interface TemporaryProps extends CommonProps {
  /** Message content. */
  children?: React.ReactNode;
}

/** Temporary message as defined in 9-Zone UI spec. Used in [[Footer]] component. */
export class Temporary extends React.PureComponent<TemporaryProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-temporary",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.children}
      </div>
    );
  }
}
