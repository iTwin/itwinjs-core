/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../../../utilities/Props";
import "./Label.scss";

/** Properties of [[Label]] component. */
export interface LabelProps extends CommonProps {
  /** Label text. */
  children: string;
}

/** Label component used in status message. I.e. [[MessageLayout]] */
export class Label extends React.PureComponent<LabelProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-content-label",
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
