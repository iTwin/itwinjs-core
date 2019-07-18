/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolAssistance */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./NewDot.scss";

/** 'New' dot used in Tool assistance instruction component.
 * @internal
 */
export class NewDot extends React.PureComponent<CommonProps> {
  public render() {
    const className = classnames(
      "nz-footer-toolAssistance-newDot",
      this.props.className);

    return (
      <span
        className={className}
        style={this.props.style}
      />
    );
  }
}
